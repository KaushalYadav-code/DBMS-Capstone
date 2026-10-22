import { Router } from "express";
import { getDatabase } from "../db.js";
import { buildPackageVersionIntelligence } from "../intelligence/analysis.js";
import { ApiError, escapeRegex, notFound, optionalText, parseLimit, parseObjectId, requireOneOf, requireText, sendData } from "./helpers.js";

const router = Router();
const packageFields = ["name", "version", "ecosystem", "license", "description", "comparisonVersion"];

async function includeProjects(db, packageDocuments) {
  if (!packageDocuments.length) return [];
  const packageIds = packageDocuments.map((pkg) => pkg._id);
  const [relationships, projects] = await Promise.all([
    db.collection("dependencies").find({ targetPackageId: { $in: packageIds } }).toArray(),
    db.collection("projects").find().project({ name: 1 }).toArray()
  ]);
  const projectNames = new Map(projects.map((project) => [String(project._id), project.name]));
  const byPackage = new Map(packageIds.map((id) => [String(id), []]));
  for (const relationship of relationships) {
    const list = byPackage.get(String(relationship.targetPackageId));
    if (!list) continue;
    const existingMembership = list.find((item) => String(item.projectId) === String(relationship.projectId));
    if (existingMembership) {
      if (relationship.reviewStatus === "review") existingMembership.reviewStatus = "review";
      continue;
    }
    list.push({
      projectId: relationship.projectId,
      projectName: projectNames.get(String(relationship.projectId)) || "Unknown project",
      dependencyId: relationship._id,
      dependencyType: relationship.dependencyType,
      reviewStatus: relationship.reviewStatus || "current",
      versionConstraint: relationship.versionConstraint || ""
    });
  }
  const linksByPackage = new Map(packageIds.map((id) => [String(id), []]));
  for (const relationship of relationships) {
    linksByPackage.get(String(relationship.targetPackageId))?.push(relationship);
  }
  return packageDocuments.map((pkg) => ({
    ...pkg,
    projects: byPackage.get(String(pkg._id)) || [],
    versionIntelligence: buildPackageVersionIntelligence(pkg, linksByPackage.get(String(pkg._id)) || [])
  }));
}

function packageQuery(req) {
  const query = {};
  if (req.query.ecosystem) query.ecosystem = String(req.query.ecosystem).trim();
  if (req.query.license) query.license = new RegExp(escapeRegex(String(req.query.license).trim()), "i");
  if (req.query.q || req.query.name) {
    const search = new RegExp(escapeRegex(String(req.query.q || req.query.name).trim()), "i");
    query.$or = [{ name: search }, { description: search }, { ecosystem: search }, { license: search }, { version: search }];
  }
  return query;
}

router.get("/", async (req, res) => {
  const db = getDatabase();
  const query = packageQuery(req);
  let matchingTargetIds;
  if (req.query.projectId || req.query.project) {
    const projectId = parseObjectId(String(req.query.projectId || req.query.project), "Project ID");
    matchingTargetIds = await db.collection("dependencies").distinct("targetPackageId", { projectId });
  }
  if (req.query.status && req.query.status !== "all") {
    const status = requireOneOf(String(req.query.status), "Status", ["current", "review", "outdated", "behind-comparison"]);
    if (status !== "behind-comparison") {
      const reviewStatus = status === "outdated" ? "review" : status;
      const statusTargetIds = await db.collection("dependencies").distinct("targetPackageId", { reviewStatus });
      matchingTargetIds = matchingTargetIds
        ? matchingTargetIds.filter((id) => statusTargetIds.some((statusId) => statusId.equals(id)))
        : statusTargetIds;
    }
  }
  if (matchingTargetIds) query._id = { $in: matchingTargetIds };
  const packageDocuments = await db.collection("packages")
    .find(query)
    .sort({ name: 1, version: 1 })
    .limit(parseLimit(req.query.limit))
    .toArray();
  let enriched = await includeProjects(db, packageDocuments);
  if (String(req.query.status || "") === "behind-comparison") {
    enriched = enriched.filter((pkg) => pkg.versionIntelligence.behindComparison);
  }
  sendData(res, enriched);
});

router.get("/:id", async (req, res) => {
  const db = getDatabase();
  const id = parseObjectId(req.params.id, "Package ID");
  const pkg = await db.collection("packages").findOne({ _id: id });
  if (!pkg) notFound("Package");
  const [result] = await includeProjects(db, [pkg]);
  sendData(res, result);
});

router.post("/", async (req, res) => {
  const db = getDatabase();
  const name = requireText(req.body.name, "Package name", 120);
  const version = requireText(req.body.version, "Package version", 60);
  const ecosystem = requireText(req.body.ecosystem, "Ecosystem", 40);
  const now = new Date();
  const packageDocument = {
    name,
    version,
    ecosystem,
    license: optionalText(req.body.license, "License", 80) || "Unspecified",
    description: optionalText(req.body.description, "Description", 500),
    comparisonVersion: optionalText(req.body.comparisonVersion, "Comparison version", 60),
    createdAt: now,
    updatedAt: now
  };
  try {
    const result = await db.collection("packages").insertOne(packageDocument);
    sendData(res, { ...packageDocument, _id: result.insertedId, projects: [] }, 201);
  } catch (error) {
    if (error.code === 11000) throw new ApiError(409, "DUPLICATE_PACKAGE", "That package version already exists in this ecosystem.");
    throw error;
  }
});

router.put("/:id", async (req, res) => {
  const db = getDatabase();
  const id = parseObjectId(req.params.id, "Package ID");
  const updates = {};
  for (const field of packageFields) {
    if (req.body[field] === undefined) continue;
    if (["name", "version", "ecosystem"].includes(field)) updates[field] = requireText(req.body[field], field[0].toUpperCase() + field.slice(1), field === "name" ? 120 : field === "ecosystem" ? 40 : 60);
    else updates[field] = optionalText(req.body[field], field[0].toUpperCase() + field.slice(1), field === "license" ? 80 : field === "comparisonVersion" ? 60 : 500);
  }
  if (!Object.keys(updates).length) throw new ApiError(400, "VALIDATION_ERROR", "Provide at least one package field to update.");
  updates.updatedAt = new Date();
  try {
    const result = await db.collection("packages").findOneAndUpdate({ _id: id }, { $set: updates }, { returnDocument: "after" });
    const pkg = result?.value ?? result;
    if (!pkg) notFound("Package");
    const [withProjects] = await includeProjects(db, [pkg]);
    sendData(res, withProjects);
  } catch (error) {
    if (error.code === 11000) throw new ApiError(409, "DUPLICATE_PACKAGE", "That package version already exists in this ecosystem.");
    throw error;
  }
});

router.delete("/:id", async (req, res) => {
  const db = getDatabase();
  const id = parseObjectId(req.params.id, "Package ID");
  const pkg = await db.collection("packages").findOne({ _id: id }, { projection: { _id: 1 } });
  if (!pkg) notFound("Package");
  const [dependencies, vulnerabilities] = await Promise.all([
    db.collection("dependencies").deleteMany({ $or: [{ sourcePackageId: id }, { targetPackageId: id }] }),
    db.collection("vulnerabilities").deleteMany({ packageId: id })
  ]);
  const result = await db.collection("packages").deleteOne({ _id: id });
  if (!result.deletedCount) notFound("Package");
  sendData(res, { deleted: true, removedDependencies: dependencies.deletedCount, removedVulnerabilities: vulnerabilities.deletedCount });
});

export default router;
