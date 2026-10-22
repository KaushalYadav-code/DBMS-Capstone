import test from "node:test";
import assert from "node:assert/strict";
import { analyzeVersion, calculatePortfolioAnalytics, classifyEvidence, classifyVulnerabilityMatch } from "../src/intelligence/analysis.js";
import { compareSemver, parseSemver, satisfiesSemverRange } from "../src/intelligence/semver.js";

test("semantic version ordering handles releases and prerelease identifiers", () => {
  assert.equal(compareSemver("v1.2.3", "1.2.3+build.4"), 0);
  assert.equal(compareSemver("1.2.3-alpha.2", "1.2.3-alpha.10"), -1);
  assert.equal(compareSemver("1.2.3-rc.1", "1.2.3"), -1);
  assert.equal(compareSemver("1.2", "1.2.0"), null);
  assert.equal(parseSemver("1.02.3"), null);
});

test("common semver ranges and unsupported syntax are evaluated without guessing", () => {
  assert.equal(satisfiesSemverRange("1.9.0", "^1.2.3"), true);
  assert.equal(satisfiesSemverRange("2.0.0", "^1.2.3"), false);
  assert.equal(satisfiesSemverRange("0.2.9", "^0.2.3"), true);
  assert.equal(satisfiesSemverRange("0.3.0", "^0.2.3"), false);
  assert.equal(satisfiesSemverRange("1.4.9", "~1.4.2"), true);
  assert.equal(satisfiesSemverRange("1.5.0", "~1.4.2"), false);
  assert.equal(satisfiesSemverRange("1.5.0", ">=1.0.0 <2.0.0"), true);
  assert.equal(satisfiesSemverRange("1.3.8", "1.2.x"), false);
  assert.equal(satisfiesSemverRange("1.3.0", "1.2.0 - 1.3.0"), true);
  assert.equal(satisfiesSemverRange("1.2.5", "^1.0.0 || ^2.0.0"), true);
  assert.equal(satisfiesSemverRange("3.0.0", "latest"), null);
  assert.equal(satisfiesSemverRange("3.0.0", "latest || <2.0.0"), null);
  assert.equal(satisfiesSemverRange("3.0.0", ""), null);
});

test("version intelligence requires parseable installed and comparison versions", () => {
  assert.equal(analyzeVersion("1.2.0", "").state, "unknown");
  assert.equal(analyzeVersion("latest", "2.0.0").state, "unknown");
  assert.equal(analyzeVersion("1.2.0", "1.3.0", "^1.2.0").state, "behind-comparison");
  assert.equal(analyzeVersion("1.2.0", "1.3.0", "^1.2.0").constraintFit, true);
  assert.equal(analyzeVersion("1.2.0", "2.0.0", "~1.2.0").constraintState, "blocks-comparison");
  assert.equal(analyzeVersion("1.3.0", "1.2.9").state, "at-or-above-comparison");
});

test("vulnerability matching requires exact ecosystem and package identity", () => {
  const advisory = { identifier: "DG-DEMO-TEST", affectedVersions: "demo range: < 2.0.0" };
  const source = { name: "demo-package", ecosystem: "npm" };
  assert.equal(classifyVulnerabilityMatch(advisory, source, { name: "DEMO-PACKAGE", ecosystem: "NPM", version: "1.9.9" }).status, "affected");
  assert.equal(classifyVulnerabilityMatch(advisory, source, { name: "demo-package", ecosystem: "npm", version: "2.0.0" }).status, "not-affected");
  assert.equal(classifyVulnerabilityMatch(advisory, source, { name: "demo-package", ecosystem: "PyPI", version: "1.9.9" }), null);
  assert.equal(classifyVulnerabilityMatch({ ...advisory, affectedVersions: "release stream: stable" }, source, { name: "demo-package", ecosystem: "npm", version: "1.0.0" }).status, "range-unknown");
  assert.equal(classifyEvidence({ identifier: "DG-DEMO-TEST" }), "sample");
  assert.equal(classifyEvidence({ identifier: "CVE-like-note" }), "unverified");
  assert.equal(classifyEvidence({ identifier: "CVE-like-note", verificationStatus: "verified" }), "verified");
});

test("project analytics combine stored review labels, comparison gaps, and affected notes", () => {
  const projects = [{ _id: "project-a", name: "Payments" }, { _id: "project-empty", name: "Empty" }];
  const packages = [
    { _id: "package-a", name: "demo-package", ecosystem: "npm", version: "1.9.0", comparisonVersion: "2.0.0" },
    { _id: "package-b", name: "safe-package", ecosystem: "npm", version: "3.0.0" }
  ];
  const dependencies = [
    { _id: "edge-a", projectId: "project-a", targetPackageId: "package-a", versionConstraint: "^1.0.0", reviewStatus: "current" },
    { _id: "edge-b", projectId: "project-a", targetPackageId: "package-b", versionConstraint: "^3.0.0", reviewStatus: "review" }
  ];
  const vulnerabilities = [{ _id: "finding-a", packageId: "package-a", identifier: "DEMO-1", status: "Open", severity: "High", affectedVersions: "< 2.0.0" }];
  const result = calculatePortfolioAnalytics({ projects, packages, dependencies, vulnerabilities });
  assert.equal(result.totals.behindComparison, 1);
  assert.equal(result.totals.needsReview, 1);
  assert.equal(result.totals.affectedDependencies, 1);
  assert.equal(result.totals.openMatchedFindings, 1);
  assert.equal(result.health.riskyDependencies, 2);
  assert.equal(result.health.score, 0);
  assert.equal(result.projects.find((project) => project.projectId === "project-empty").healthScore, null);
  assert.match(result.health.formula, /unsupported affected ranges are not counted/);
});
