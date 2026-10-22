import { Router } from "express";
import { getDatabase } from "../db.js";
import { classifyEvidence, classifyVulnerabilityMatch } from "../intelligence/analysis.js";
import { ApiError, escapeRegex, notFound, optionalHttpUrl, optionalText, parseLimit, parseObjectId, requireOneOf, requireText, sendData } from "./helpers.js";

const router = Router();
const severities = ["Critical", "High", "Medium", "Low", "Informational"];
const statuses = ["Open", "Resolved", "Accepted"];

async function enrich(db, records) {
  const ids = [...new Map(records.map((record) => [String(record.packageId), record.packageId])).values()];
  const [referencedPackages, allPackages] = await Promise.all([
    ids.length ? db.collection("packages").find({ _id: { $in: ids } }).project({ name: 1, version: 1, ecosystem: 1 }).toArray() : [],
    db.collection("packages").find().project({ name: 1, version: 1, ecosystem: 1, comparisonVersion: 1 }).toArray()
  ]);
  const packages = [...new Map([...referencedPackages, ...allPackages].map((pkg) => [String(pkg._id), pkg])).values()];
  const packageMap = new Map(packages.map((pkg) => [String(pkg._id), pkg]));
  return records.map((record) => {
    const pkg = packageMap.get(String(record.packageId)) || null;
    const matchedPackages = pkg ? packages.flatMap((candidate) => {
      const match = classifyVulnerabilityMatch(record, pkg, candidate);
      return match ? [{
        packageId: candidate._id,
        name: candidate.name,
        version: candidate.version,
        ecosystem: candidate.ecosystem,
        comparisonVersion: candidate.comparisonVersion || "",
        matchStatus: match.status
      }] : [];
    }) : [];
    return { ...record, package: pkg, verificationStatus: classifyEvidence(record), matchedPackages };
  });
}

function verificationStatus(value, identifier = "") {
  if (value === undefined && /^DG-DEMO-/i.test(identifier)) return "sample";
  return requireOneOf(value || "unverified", "Evidence status", ["sample", "unverified", "verified"]);
}

router.get("/", async (req, res) => {
  const db = getDatabase();
  const query = {};
  if (req.query.packageId) query.packageId = parseObjectId(String(req.query.packageId), "Package ID");
  if (req.query.severity) query.severity = requireOneOf(String(req.query.severity), "Severity", severities);
  if (req.query.status) query.status = requireOneOf(String(req.query.status), "Status", statuses);
  if (req.query.q || req.query.identifier) {
    const search = new RegExp(escapeRegex(String(req.query.q || req.query.identifier).trim()), "i");
    query.$or = [{ identifier: search }, { description: search }, { recommendedAction: search }, { affectedVersions: search }];
  }
  let records = await db.collection("vulnerabilities")
    .find(query)
    .sort({ updatedAt: -1, identifier: 1 })
    .limit(parseLimit(req.query.limit))
    .toArray();
  records = await enrich(db, records);
  if (req.query.packageName || req.query.ecosystem) {
    const packageName = req.query.packageName ? new RegExp(escapeRegex(String(req.query.packageName).trim()), "i") : null;
    const ecosystem = String(req.query.ecosystem || "").toLowerCase();
    records = records.filter((record) => (!packageName || packageName.test(record.package?.name || "")) && (!ecosystem || String(record.package?.ecosystem || "").toLowerCase() === ecosystem));
  }
  sendData(res, records);
});

router.get("/:id", async (req, res) => {
  const db = getDatabase();
  const id = parseObjectId(req.params.id, "Vulnerability ID");
  const record = await db.collection("vulnerabilities").findOne({ _id: id });
  if (!record) notFound("Vulnerability");
  const [result] = await enrich(db, [record]);
  sendData(res, result);
});

router.post("/", async (req, res) => {
  const db = getDatabase();
  const packageId = parseObjectId(requireText(req.body.packageId, "Package ID", 24), "Package ID");
  if (!await db.collection("packages").findOne({ _id: packageId }, { projection: { _id: 1 } })) notFound("Package");
  const now = new Date();
  const identifier = requireText(req.body.identifier, "Identifier", 100);
  const evidenceStatus = verificationStatus(req.body.verificationStatus, identifier);
  const sourceUrl = optionalHttpUrl(req.body.sourceUrl, "Source URL", 500);
  if (evidenceStatus === "verified" && !sourceUrl) throw new ApiError(400, "VALIDATION_ERROR", "A source URL is required when a note is marked verified.");
  const record = {
    packageId,
    identifier,
    severity: requireOneOf(req.body.severity, "Severity", severities),
    description: optionalText(req.body.description, "Description", 1000),
    affectedVersions: requireText(req.body.affectedVersions, "Affected versions", 200),
    recommendedAction: requireText(req.body.recommendedAction, "Recommended action", 1000),
    status: requireOneOf(req.body.status || "Open", "Status", statuses),
    verificationStatus: evidenceStatus,
    sourceUrl,
    createdAt: now,
    updatedAt: now
  };
  try {
    const result = await db.collection("vulnerabilities").insertOne(record);
    const [enriched] = await enrich(db, [{ ...record, _id: result.insertedId }]);
    sendData(res, enriched, 201);
  } catch (error) {
    if (error.code === 11000) throw new ApiError(409, "DUPLICATE_VULNERABILITY", "That vulnerability identifier already exists.");
    throw error;
  }
});

router.put("/:id", async (req, res) => {
  const db = getDatabase();
  const id = parseObjectId(req.params.id, "Vulnerability ID");
  const current = await db.collection("vulnerabilities").findOne({ _id: id });
  if (!current) notFound("Vulnerability");
  const updates = {};
  if (req.body.packageId !== undefined) {
    updates.packageId = parseObjectId(requireText(req.body.packageId, "Package ID", 24), "Package ID");
    if (!await db.collection("packages").findOne({ _id: updates.packageId }, { projection: { _id: 1 } })) notFound("Package");
  }
  if (req.body.identifier !== undefined) updates.identifier = requireText(req.body.identifier, "Identifier", 100);
  if (req.body.severity !== undefined) updates.severity = requireOneOf(req.body.severity, "Severity", severities);
  if (req.body.description !== undefined) updates.description = optionalText(req.body.description, "Description", 1000);
  if (req.body.affectedVersions !== undefined) updates.affectedVersions = requireText(req.body.affectedVersions, "Affected versions", 200);
  if (req.body.recommendedAction !== undefined) updates.recommendedAction = requireText(req.body.recommendedAction, "Recommended action", 1000);
  if (req.body.status !== undefined) updates.status = requireOneOf(req.body.status, "Status", statuses);
  if (req.body.verificationStatus !== undefined) updates.verificationStatus = verificationStatus(req.body.verificationStatus, req.body.identifier ?? current.identifier);
  if (req.body.sourceUrl !== undefined) updates.sourceUrl = optionalHttpUrl(req.body.sourceUrl, "Source URL", 500);
  const resultingStatus = updates.verificationStatus || classifyEvidence(current);
  const resultingSource = updates.sourceUrl ?? current.sourceUrl ?? "";
  if (resultingStatus === "verified" && !resultingSource) throw new ApiError(400, "VALIDATION_ERROR", "A source URL is required when a note is marked verified.");
  if (!Object.keys(updates).length) throw new ApiError(400, "VALIDATION_ERROR", "Provide at least one vulnerability field to update.");
  updates.updatedAt = new Date();
  try {
    await db.collection("vulnerabilities").updateOne({ _id: id }, { $set: updates });
    const updated = await db.collection("vulnerabilities").findOne({ _id: id });
    const [enriched] = await enrich(db, [updated]);
    sendData(res, enriched);
  } catch (error) {
    if (error.code === 11000) throw new ApiError(409, "DUPLICATE_VULNERABILITY", "That vulnerability identifier already exists.");
    throw error;
  }
});

router.delete("/:id", async (req, res) => {
  const db = getDatabase();
  const id = parseObjectId(req.params.id, "Vulnerability ID");
  const result = await db.collection("vulnerabilities").deleteOne({ _id: id });
  if (!result.deletedCount) notFound("Vulnerability");
  sendData(res, { deleted: true });
});

export default router;
