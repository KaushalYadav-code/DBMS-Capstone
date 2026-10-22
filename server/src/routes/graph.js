import { Router } from "express";
import { getDatabase } from "../db.js";
import {
  analyzeVersion,
  buildPackageVersionIntelligence,
  classifyEvidence,
  classifyVulnerabilityMatch
} from "../intelligence/analysis.js";
import { notFound, parseObjectId, requireText, sendData } from "./helpers.js";

const router = Router();

router.get("/", async (req, res) => {
  const db = getDatabase();
  const projectId = parseObjectId(requireText(String(req.query.projectId || ""), "Project ID", 24), "Project ID");
  const project = await db.collection("projects").findOne({ _id: projectId });
  if (!project) notFound("Project");

  const relationships = await db.collection("dependencies")
    .find({ projectId })
    .sort({ createdAt: 1, _id: 1 })
    .toArray();
  const packageIds = [...new Map(relationships.flatMap((row) => [row.sourcePackageId, row.targetPackageId])
    .filter(Boolean).map((id) => [String(id), id])).values()];
  const [packages, vulnerabilities] = await Promise.all([
    packageIds.length ? db.collection("packages").find({ _id: { $in: packageIds } }).toArray() : [],
    db.collection("vulnerabilities").find().sort({ identifier: 1 }).toArray()
  ]);
  const referencedPackageIds = [...new Map(vulnerabilities.map((record) => record.packageId).filter(Boolean)
    .map((id) => [String(id), id])).values()];
  const referencedPackages = referencedPackageIds.length
    ? await db.collection("packages").find({ _id: { $in: referencedPackageIds } }).toArray()
    : [];
  const packagesById = new Map([...packages, ...referencedPackages].map((pkg) => [String(pkg._id), pkg]));
  const packagesByGraphId = new Map(packages.map((pkg) => [String(pkg._id), pkg]));
  const linksByTarget = new Map();
  for (const row of relationships) {
    const list = linksByTarget.get(String(row.targetPackageId)) || [];
    list.push(row);
    linksByTarget.set(String(row.targetPackageId), list);
  }

  const rootId = `project:${projectId.toHexString()}`;
  const nodes = [{
    id: rootId,
    kind: "project",
    projectId: projectId.toHexString(),
    label: project.name,
    ecosystem: project.ecosystem || ""
  }];
  for (const pkg of packages) {
    const versionIntelligence = buildPackageVersionIntelligence(pkg, linksByTarget.get(String(pkg._id)) || []);
    const matches = [];
    for (const record of vulnerabilities) {
      const match = classifyVulnerabilityMatch(record, packagesById.get(String(record.packageId)), pkg);
      if (match) matches.push({
        id: String(record._id),
        identifier: record.identifier,
        severity: record.severity,
        status: record.status || "Open",
        affectedVersions: record.affectedVersions || "",
        recommendedAction: record.recommendedAction || "",
        verificationStatus: classifyEvidence(record),
        matchStatus: match.status
      });
    }
    nodes.push({
      id: `package:${pkg._id.toHexString()}`,
      kind: "package",
      packageId: pkg._id.toHexString(),
      label: pkg.name,
      package: pkg,
      versionIntelligence,
      vulnerabilities: matches
    });
  }

  const edges = relationships.flatMap((row) => {
    const sourcePackage = row.sourcePackageId ? packagesByGraphId.get(String(row.sourcePackageId)) : null;
    const targetPackage = packagesByGraphId.get(String(row.targetPackageId));
    if (!targetPackage || (row.sourcePackageId && !sourcePackage)) return [];
    const versionIntelligence = analyzeVersion(targetPackage.version || "", targetPackage.comparisonVersion || "", row.versionConstraint || "");
    return [{
      id: row._id.toHexString(),
      projectId: projectId.toHexString(),
      sourcePackageId: row.sourcePackageId?.toHexString() || null,
      targetPackageId: row.targetPackageId.toHexString(),
      source: sourcePackage ? `package:${sourcePackage._id.toHexString()}` : rootId,
      target: `package:${targetPackage._id.toHexString()}`,
      dependencyType: row.dependencyType || "direct",
      versionConstraint: row.versionConstraint || "",
      reviewStatus: row.reviewStatus || "current",
      versionIntelligence
    }];
  });

  let selection = null;
  if (req.query.packageId) {
    const selectedId = parseObjectId(String(req.query.packageId), "Package ID").toHexString();
    const selected = packagesByGraphId.get(selectedId);
    if (!selected) notFound("Package in this project graph");
    const directDependencies = edges.filter((edge) => edge.sourcePackageId === selectedId);
    const dependents = edges.filter((edge) => edge.targetPackageId === selectedId && edge.sourcePackageId);
    const projectMemberships = edges.filter((edge) => edge.source === rootId && edge.targetPackageId === selectedId);
    const selectedNode = nodes.find((node) => node.packageId === selectedId);
    selection = {
      packageId: selectedId,
      directDependencies: directDependencies.map((edge) => edge.targetPackageId),
      dependents: dependents.map((edge) => edge.sourcePackageId),
      projectMemberships: projectMemberships.map((edge) => ({ dependencyId: edge.id, versionConstraint: edge.versionConstraint })),
      vulnerabilities: selectedNode?.vulnerabilities || []
    };
  }

  sendData(res, {
    project: { id: projectId.toHexString(), name: project.name, ecosystem: project.ecosystem || "" },
    nodes,
    edges,
    selection
  });
});

export default router;
