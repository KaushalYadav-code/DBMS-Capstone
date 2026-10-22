import { apiConnected, vulnerabilities } from "../state.js";
import { $, esc } from "../helpers.js";

export function renderVulnerabilities() {
  if (!$("#vulnerabilityList")) return;
  $("#vulnerabilityList").innerHTML = vulnerabilities.map(finding => {
    const packageRecord = finding.package || {};
    const severity = String(finding.severity || "low").toLowerCase();
    const evidence = finding.verificationStatus || "unverified";
    const evidenceLabel = evidence === "sample" ? "Sample data" : evidence === "verified" ? "User marked verified" : "Unverified note";
    const matches = finding.matchedPackages || [];
    const chips = matches.length ? matches.map(match =>
      '<span class="match-chip ' + (match.matchStatus === "affected" ? "affected" : match.matchStatus === "not-affected" ? "not-affected" : "") + '">' + esc(match.name) + '@' + esc(match.version) + ' · ' + esc(match.matchStatus === "affected" ? "affected" : match.matchStatus === "not-affected" ? "outside range" : "range unknown") + '</span>'
    ).join("") : '<span class="match-chip">No stored package with the same identity</span>';
    return '<div class="vuln-card"><div><div class="vuln-id">' + esc(finding.identifier) + '</div><div class="cell-sub">' + esc(finding.status || "Open") + '</div><span class="verification-badge ' + esc(evidence) + '">' + evidenceLabel + '</span></div><div class="vuln-package">' + esc(packageRecord.name || "Package") + ' <small>' + esc(packageRecord.ecosystem || "") + ' · reference version ' + esc(packageRecord.version || "—") + ' · affected rule ' + esc(finding.affectedVersions || "Not recorded") + '</small><div class="match-list">' + chips + '</div></div><span class="severity-pill ' + esc(severity) + '">' + esc(finding.severity) + '</span><div class="vuln-recommendation">' + esc(finding.recommendedAction || "") + (finding.sourceUrl ? '<div class="version-detail">Source: ' + esc(finding.sourceUrl) + '</div>' : "") + '</div><div class="row-actions"><button class="small-action" data-record-action data-edit="vulnerability" data-id="' + esc(finding.id) + '">Edit</button><button class="small-action danger" data-record-action data-delete="vulnerability" data-id="' + esc(finding.id) + '">Delete</button></div></div>';
  }).join("") || '<div class="empty-state">' + (apiConnected ? "No recorded findings in this workspace." : "Vulnerability records are hidden until the API reconnects.") + "</div>";
}
