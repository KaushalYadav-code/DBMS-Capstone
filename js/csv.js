import { projects, vulnerabilities } from "./state.js";
import { ago, comparisonLabel, pkgProjects, pkgStatus, stats, toast } from "./helpers.js";
import { filteredPackages } from "./features/packages.js";

function downloadCSV(filename, headers, rows) {
  const quote = value => '"' + String(value ?? "").replace(/"/g, '""') + '"';
  const content = [headers, ...rows].map(row => row.map(quote).join(",")).join("\r\n");
  const blob = new Blob(["\uFEFF" + content], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
  toast(filename + " downloaded");
}

export function exportPackages() {
  downloadCSV("depgraph-dependencies.csv", ["Package", "Installed version", "Comparison version", "Ecosystem", "License", "Projects", "Comparison status", "Manual review label", "Description"], filteredPackages().map(packageRecord => [packageRecord.name, packageRecord.version, packageRecord.comparisonVersion, packageRecord.ecosystem, packageRecord.license, pkgProjects(packageRecord), comparisonLabel(packageRecord), pkgStatus(packageRecord), packageRecord.description]));
}

export function exportVulnerabilities() {
  downloadCSV("depgraph-vulnerabilities.csv", ["Identifier", "Package", "Version", "Ecosystem", "Severity", "Affected versions", "Match status", "Evidence status", "Source URL", "Recommendation", "Record status"], vulnerabilities.map(finding => [finding.identifier, finding.package?.name, finding.package?.version, finding.package?.ecosystem, finding.severity, finding.affectedVersions, (finding.matchedPackages || []).map(match => match.name + "@" + match.version + ":" + match.matchStatus).join("; "), finding.verificationStatus, finding.sourceUrl, finding.recommendedAction, finding.status]));
}

export function exportProjects() {
  downloadCSV("depgraph-projects.csv", ["Project", "Description", "Owner", "Dependency links", "Needs review", "Behind comparison", "Affected links", "Health score", "Updated"], projects.map(project => {
    const summary = stats(project);
    return [project.name, project.description, project.owner, summary.total, summary.old, summary.behind, summary.affected, summary.score === null ? "Not assessed" : summary.score + "/100", ago(project.updatedAt)];
  }));
}
