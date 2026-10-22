import { compareSemver, satisfiesSemverRange } from "./semver.js";

export function analyzeVersion(installedVersion, comparisonVersion, versionConstraint = "") {
  const comparison = compareSemver(installedVersion, comparisonVersion);
  if (comparison === null) {
    return {
      state: "unknown",
      behindComparison: false,
      installedVersion: installedVersion || "",
      comparisonVersion: comparisonVersion || "",
      constraint: versionConstraint || "",
      constraintFit: null,
      reason: !installedVersion ? "missing-installed-version" : !comparisonVersion ? "missing-comparison-version" : "unparseable-version"
    };
  }
  const behindComparison = comparison < 0;
  const constraintFit = versionConstraint
    ? satisfiesSemverRange(comparisonVersion, versionConstraint)
    : null;
  return {
    state: behindComparison ? "behind-comparison" : "at-or-above-comparison",
    behindComparison,
    installedVersion,
    comparisonVersion,
    constraint: versionConstraint || "",
    constraintFit,
    constraintState: !versionConstraint ? "not-recorded" : constraintFit === null ? "unknown" : constraintFit ? "allows-comparison" : "blocks-comparison"
  };
}

export function cleanAffectedRange(value) {
  if (typeof value !== "string") return "";
  return value.trim()
    .replace(/^(?:demo(?:nstration)?\s+range|affected\s+range)\s*:\s*/i, "")
    .trim();
}

export function classifyEvidence(record) {
  const declared = String(record?.verificationStatus || "").toLowerCase();
  if (["sample", "unverified", "verified"].includes(declared)) return declared;
  const content = [record?.identifier, record?.description, record?.recommendedAction]
    .filter(Boolean)
    .join(" ");
  return /^DG-DEMO-/i.test(String(record?.identifier || "")) || /demonstration data only|sample data only/i.test(content)
    ? "sample"
    : "unverified";
}

function packageIdentity(pkg) {
  if (!pkg?.name || !pkg?.ecosystem) return null;
  return `${String(pkg.ecosystem).trim().toLocaleLowerCase("en-US")}\u0000${String(pkg.name).trim().toLocaleLowerCase("en-US")}`;
}

export function classifyVulnerabilityMatch(record, advisoryPackage, installedPackage) {
  if (!packageIdentity(advisoryPackage) || packageIdentity(advisoryPackage) !== packageIdentity(installedPackage)) return null;
  const affectedRange = cleanAffectedRange(record?.affectedVersions);
  const affected = affectedRange
    ? satisfiesSemverRange(installedPackage.version, affectedRange)
    : null;
  return {
    status: affected === null ? "range-unknown" : affected ? "affected" : "not-affected",
    affectedRange,
    evidence: classifyEvidence(record)
  };
}

export function buildPackageVersionIntelligence(pkg, relationships = []) {
  const base = analyzeVersion(pkg?.version || "", pkg?.comparisonVersion || "");
  const constraints = relationships.map((relationship) => ({
    dependencyId: String(relationship._id ?? relationship.id ?? ""),
    projectId: String(relationship.projectId ?? ""),
    constraint: relationship.versionConstraint || "",
    ...analyzeVersion(pkg?.version || "", pkg?.comparisonVersion || "", relationship.versionConstraint || "")
  }));
  return { ...base, constraints };
}

function activeFinding(record) {
  return !["Resolved", "Accepted", "resolved", "accepted"].includes(record?.status);
}

function findingsForPackage(pkg, packagesById, vulnerabilities) {
  const findings = [];
  for (const record of vulnerabilities) {
    if (!activeFinding(record)) continue;
    const advisoryPackage = packagesById.get(String(record.packageId));
    const match = classifyVulnerabilityMatch(record, advisoryPackage, pkg);
    if (match) findings.push({ record, match });
  }
  return findings;
}

export function calculatePortfolioAnalytics({ projects = [], packages = [], dependencies = [], vulnerabilities = [] }) {
  const packagesById = new Map(packages.map((pkg) => [String(pkg._id ?? pkg.id), pkg]));
  const findingsCache = new Map();
  const edgeDetails = dependencies.map((edge, index) => {
    const pkg = packagesById.get(String(edge.targetPackageId));
    const version = analyzeVersion(pkg?.version || "", pkg?.comparisonVersion || "", edge.versionConstraint || "");
    const key = pkg ? String(pkg._id ?? pkg.id) : "";
    let matches = findingsCache.get(key);
    if (!matches) {
      matches = pkg ? findingsForPackage(pkg, packagesById, vulnerabilities) : [];
      findingsCache.set(key, matches);
    }
    const affectedFindings = matches.filter(({ match }) => match.status === "affected");
    return {
      edge,
      key: String(edge._id ?? edge.id ?? index),
      review: edge.reviewStatus === "review",
      behindComparison: version.behindComparison,
      affectedFindings,
      affected: affectedFindings.length > 0,
      risky: edge.reviewStatus === "review" || version.behindComparison || affectedFindings.length > 0
    };
  });

  const projectSummaries = projects.map((project) => {
    const projectId = String(project._id ?? project.id);
    const details = edgeDetails.filter(({ edge }) => String(edge.projectId) === projectId);
    const affectedFindings = new Set();
    for (const detail of details) for (const item of detail.affectedFindings) affectedFindings.add(String(item.record._id ?? item.record.id));

    return {
      projectId,
      projectName: project.name || "Unnamed project",
      dependencyCount: details.length,
      needsReview: details.filter((detail) => detail.review).length,
      behindComparison: details.filter((detail) => detail.behindComparison).length,
      affectedDependencies: details.filter((detail) => detail.affected).length,
      openMatchedFindings: affectedFindings.size,
      riskyDependencies: details.filter((detail) => detail.risky).length,
      healthScore: details.length ? Math.round((details.length - details.filter((detail) => detail.risky).length) / details.length * 100) : null
    };
  });

  const totalEdges = dependencies.length;
  const affectedFindingIds = new Set();
  const needsReview = edgeDetails.filter((detail) => detail.review).length;
  const behindComparison = edgeDetails.filter((detail) => detail.behindComparison).length;
  const affectedDependencyCount = edgeDetails.filter((detail) => detail.affected).length;
  for (const detail of edgeDetails) for (const item of detail.affectedFindings) affectedFindingIds.add(String(item.record._id ?? item.record.id));
  const riskyDependencyCount = edgeDetails.filter((detail) => detail.risky).length;

  const licenseDistribution = new Map();
  for (const pkg of packages) {
    const license = pkg.license || "Unspecified";
    licenseDistribution.set(license, (licenseDistribution.get(license) || 0) + 1);
  }

  const openFindingsBySeverity = new Map();
  for (const record of vulnerabilities) {
    if (!activeFinding(record)) continue;
    const severity = record.severity || "Unspecified";
    openFindingsBySeverity.set(severity, (openFindingsBySeverity.get(severity) || 0) + 1);
  }

  return {
    totals: {
      projects: projects.length,
      packages: packages.length,
      dependencies: totalEdges,
      needsReview,
      findings: vulnerabilities.length,
      behindComparison,
      openMatchedFindings: affectedFindingIds.size,
      affectedDependencies: affectedDependencyCount
    },
    health: {
      score: totalEdges ? Math.round((totalEdges - riskyDependencyCount) / totalEdges * 100) : null,
      dependencies: totalEdges,
      riskyDependencies: riskyDependencyCount,
      formula: "100 × (dependency links without a review label, recorded comparison gap, or matched open affected-version note ÷ dependency links). Unknown comparisons and unsupported affected ranges are not counted as risks."
    },
    projects: projectSummaries,
    licenseDistribution: [...licenseDistribution.entries()]
      .map(([license, count]) => ({ license, count }))
      .sort((a, b) => b.count - a.count || a.license.localeCompare(b.license)),
    openFindingsBySeverity: [...openFindingsBySeverity.entries()]
      .map(([severity, count]) => ({ severity, count }))
      .sort((a, b) => b.count - a.count || a.severity.localeCompare(b.severity))
  };
}
