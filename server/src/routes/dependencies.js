import { Router } from "express";
import { getDatabase } from "../db.js";
import { analyzeVersion } from "../intelligence/analysis.js";
import { ApiError, escapeRegex, notFound, optionalObjectId, optionalText, parseLimit, parseObjectId, requireOneOf, requireText, sendData } from "./helpers.js";

const router = Router();
const dependencyTypes = ["direct", "transitive"];
const reviewStatuses = ["current", "review"];

async function enrichDependencies(db, dependencyDocuments) {
  const projectIds = [...new Map(dependencyDocuments.map((row) => [String(row.projectId), row.projectId])).values()];
  const packageIds = [...new Map(dependencyDocuments.flatMap((row) => [row.sourcePackageId, row.targetPackageId]).filter(Boolean).map((id) => [String(id), id])).values()];
  const [projects, packages] = await Promise.all([
    projectIds.length ? db.collection("projects").find({ _id: { $in: projectIds } }).project({ name: 1 }).toArray() : [],
    packageIds.length ? db.collection("packages").find({ _id: { $in: packageIds } }).project({ name: 1, version: 1, ecosystem: 1, comparisonVersion: 1 }).toArray() : []
  ]);
  const projectMap = new Map(projects.map((project) => [String(project._id), project]));
  const packageMap = new Map(packages.map((pkg) => [String(pkg._id), pkg]));
  return dependencyDocuments.map((row) => ({
    ...row,
    project: projectMap.get(String(row.projectId)) || null,
    sourcePackage: row.sourcePackageId ? packageMap.get(String(row.sourcePackageId)) || null : null,
    targetPackage: packageMap.get(String(row.targetPackageId)) || null,
    versionIntelligence: analyzeVersion(
      packageMap.get(String(row.targetPackageId))?.version || "",
      packageMap.get(String(row.targetPackageId))?.comparisonVersion || "",
      row.versionConstraint || ""
    )
  }));
}

async function validateReferences(db, { projectId, sourcePackageId, targetPackageId, dependencyType }) {
  const [project, targetPackage, sourcePackage] = await Promise.all([
    db.collection("projects").findOne({ _id: projectId }, { projection: { _id: 1 } }),
    db.collection("packages").findOne({ _id: targetPackageId }, { projection: { _id: 1 } }),
    sourcePackageId ? db.collection("packages").findOne({ _id: sourcePackageId }, { projection: { _id: 1 } }) : null
  ]);
  if (!project) notFound("Project");
  if (!targetPackage) notFound("Target package");
  if (sourcePackageId && !sourcePackage) notFound("Source package");
  if (sourcePackageId?.equals(targetPackageId)) throw new ApiError(400, "INVALID_DEPENDENCY", "A package cannot depend on itself.");
  if (dependencyType === "direct" && sourcePackageId) throw new ApiError(400, "INVALID_DEPENDENCY", "Direct dependencies must not have a source package.");
  if (dependencyType === "transitive" && !sourcePackageId) throw new ApiError(400, "INVALID_DEPENDENCY", "Transitive dependencies require a source package.");
  if (sourcePackageId) {
    const sourceIsInProject = await db.collection("dependencies").findOne({ projectId, targetPackageId: sourcePackageId }, { projection: { _id: 1 } });
    if (!sourceIsInProject) throw new ApiError(400, "INVALID_DEPENDENCY", "The source package must already belong to this project.");
  }
}

router.get("/", async (req, res) => {
  const db = getDatabase();
  const query = {};
  if (req.query.projectId || req.query.project) query.projectId = parseObjectId(String(req.query.projectId || req.query.project), "Project ID");
  if (req.query.sourcePackageId) query.sourcePackageId = parseObjectId(String(req.query.sourcePackageId), "Source package ID");
  if (req.query.targetPackageId || req.query.packageId) query.targetPackageId = parseObjectId(String(req.query.targetPackageId || req.query.packageId), "Target package ID");
  if (req.query.dependencyType) query.dependencyType = requireOneOf(String(req.query.dependencyType), "Dependency type", dependencyTypes);
  if (req.query.reviewStatus) query.reviewStatus = requireOneOf(String(req.query.reviewStatus), "Review status", reviewStatuses);
  let dependencies = await db.collection("dependencies")
    .find(query)
    .sort({ createdAt: -1 })
    .limit(parseLimit(req.query.limit))
    .toArray();
  dependencies = await enrichDependencies(db, dependencies);
  if (req.query.ecosystem || req.query.packageName || req.query.q) {
    const ecosystem = String(req.query.ecosystem || "").toLowerCase();
    const search = String(req.query.packageName || req.query.q || "").trim();
    const pattern = search ? new RegExp(escapeRegex(search), "i") : null;
    dependencies = dependencies.filter((row) => {
      const packages = [row.sourcePackage, row.targetPackage].filter(Boolean);
      if (ecosystem && !packages.some((pkg) => String(pkg.ecosystem || "").toLowerCase() === ecosystem)) return false;
      if (pattern && !packages.some((pkg) => pattern.test(pkg.name)) && !pattern.test(row.project?.name || "")) return false;
      return true;
    });
  }
  sendData(res, dependencies);
});

router.get("/:id", async (req, res) => {
  const db = getDatabase();
  const id = parseObjectId(req.params.id, "Dependency ID");
  const dependency = await db.collection("dependencies").findOne({ _id: id });
  if (!dependency) notFound("Dependency");
  const [result] = await enrichDependencies(db, [dependency]);
  sendData(res, result);
});

router.post("/", async (req, res) => {
  const db = getDatabase();
  const projectId = parseObjectId(requireText(req.body.projectId, "Project ID", 24), "Project ID");
  const targetPackageId = parseObjectId(requireText(req.body.targetPackageId, "Target package ID", 24), "Target package ID");
  const dependencyType = requireOneOf(req.body.dependencyType || "direct", "Dependency type", dependencyTypes);
  const sourcePackageId = optionalObjectId(req.body.sourcePackageId, "Source package ID");
  await validateReferences(db, { projectId, sourcePackageId, targetPackageId, dependencyType });
  const now = new Date();
  const document = {
    projectId,
    sourcePackageId,
    targetPackageId,
    dependencyType,
    versionConstraint: optionalText(req.body.versionConstraint, "Version constraint", 100),
    reviewStatus: requireOneOf(req.body.reviewStatus || "current", "Review status", reviewStatuses),
    createdAt: now,
    updatedAt: now
  };
  try {
    const result = await db.collection("dependencies").insertOne(document);
    const [enriched] = await enrichDependencies(db, [{ ...document, _id: result.insertedId }]);
    sendData(res, enriched, 201);
  } catch (error) {
    if (error.code === 11000) throw new ApiError(409, "DUPLICATE_DEPENDENCY", "That dependency relationship already exists in this project.");
    throw error;
  }
});

router.put("/:id", async (req, res) => {
  const db = getDatabase();
  const id = parseObjectId(req.params.id, "Dependency ID");
  const existing = await db.collection("dependencies").findOne({ _id: id });
  if (!existing) notFound("Dependency");
  const projectId = req.body.projectId === undefined ? existing.projectId : parseObjectId(requireText(req.body.projectId, "Project ID", 24), "Project ID");
  const targetPackageId = req.body.targetPackageId === undefined ? existing.targetPackageId : parseObjectId(requireText(req.body.targetPackageId, "Target package ID", 24), "Target package ID");
  const dependencyType = req.body.dependencyType === undefined ? existing.dependencyType : requireOneOf(req.body.dependencyType, "Dependency type", dependencyTypes);
  const sourcePackageId = req.body.sourcePackageId === undefined ? existing.sourcePackageId || null : optionalObjectId(req.body.sourcePackageId, "Source package ID");
  await validateReferences(db, { projectId, sourcePackageId, targetPackageId, dependencyType });
  const updates = { projectId, sourcePackageId, targetPackageId, dependencyType, updatedAt: new Date() };
  if (req.body.versionConstraint !== undefined) updates.versionConstraint = optionalText(req.body.versionConstraint, "Version constraint", 100);
  if (req.body.reviewStatus !== undefined) updates.reviewStatus = requireOneOf(req.body.reviewStatus, "Review status", reviewStatuses);
  try {
    await db.collection("dependencies").updateOne({ _id: id }, { $set: updates });
    const updated = await db.collection("dependencies").findOne({ _id: id });
    const [enriched] = await enrichDependencies(db, [updated]);
    sendData(res, enriched);
  } catch (error) {
    if (error.code === 11000) throw new ApiError(409, "DUPLICATE_DEPENDENCY", "That dependency relationship already exists in this project.");
    throw error;
  }
});

router.delete("/:id", async (req, res) => {
  const db = getDatabase();
  const id = parseObjectId(req.params.id, "Dependency ID");
  const result = await db.collection("dependencies").deleteOne({ _id: id });
  if (!result.deletedCount) notFound("Dependency");
  sendData(res, { deleted: true });
});

export default router;
