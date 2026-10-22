import { apiConnected, dashboardData, dependencies, packages, projects, vulnerabilities } from "../state.js";
import { $, ago, esc, initials, metric, stats } from "../helpers.js";

function findingRow(finding) {
  const packageRecord = finding.package || {};
  const severity = String(finding.severity || "low").toLowerCase();
  return '<div class="finding-row"><div class="finding-icon ' + (severity === "medium" ? "medium" : '') + '"><svg fill="none" stroke="currentColor" stroke-width="1.8"><use href="#i-alert"/></svg></div><div><div class="finding-name">' + esc(packageRecord.name || "Package") + ' <span class="finding-identifier">· ' + esc(finding.identifier) + '</span></div><div class="finding-meta">' + esc(packageRecord.version || "") + ' · ' + esc(finding.affectedVersions || "") + '</div></div><span class="severity-pill ' + esc(severity) + '">' + esc(finding.severity) + '</span></div>';
}

export function renderDashboard() {
  const totals = dashboardData?.totals || {};
  const old = totals.needsReview ?? dependencies.filter(item => item.reviewStatus === "review").length;
  const edgeCount = totals.dependencies ?? dependencies.length;
  const score = dashboardData?.health?.score ?? null;
  const projectCount = totals.projects ?? projects.length;
  const packageCount = totals.packages ?? packages.length;
  const findingCount = totals.findings ?? vulnerabilities.length;
  const behind = totals.behindComparison ?? 0;
  const affected = totals.affectedDependencies ?? 0;
  const shown = value => apiConnected ? value : "—";

  $("#summaryGrid").innerHTML = [
    metric("Projects tracked", shown(projectCount), "Across this workspace", "i-folder", "blue"),
    metric("Package records", shown(packageCount), "Across all project inventories", "i-box", "green"),
    metric("Dependency links", shown(edgeCount), "Stored project relationships", "i-nodes", "blue"),
    metric("Behind comparison", shown(behind), "Stored comparison versions", "i-alert", "amber", behind ? "attention" : ""),
    metric("Affected links", shown(affected), "Matched open notes with affected ranges", "i-shield", "red", affected ? "attention" : ""),
    metric("Needs review", shown(old), "Maintainer-entered labels", "i-alert", "amber", old ? "attention" : ""),
    metric("Recorded findings", shown(findingCount), `${totals.openMatchedFindings || 0} matched affected ranges`, "i-shield", "red")
  ].join("");

  $("#navProjectCount").textContent = shown(projectCount);
  $("#navPackageCount").textContent = shown(packageCount);
  $("#navVulnCount").textContent = shown(findingCount);

  const licensed = packages.filter(item => item.license && item.license !== "Unspecified").length;
  const licensePct = packageCount ? Math.round(licensed / packageCount * 100) : 0;
  $("#portfolioScore").textContent = apiConnected && score !== null ? score : "—";
  $(".score-ring").style.setProperty("--score", `${score || 0}%`);
  $(".score-ring").title = dashboardData?.health?.formula || "Health score is calculated from stored dependency records.";
  $("#portfolioStatus").textContent = !apiConnected ? "Data unavailable" : score === null ? "Not assessed" : score >= 80 ? "Healthy inventory" : score >= 50 ? "Review needed" : "Attention needed";
  $("#portfolioDescription").textContent = !apiConnected
    ? "Reconnect to DepGraph to load dependency and risk records."
    : edgeCount
      ? `${totals.affectedDependencies} affected links · ${behind} behind recorded comparisons · ${old} manually marked for review.`
      : "No dependency links are recorded yet.";
  $("#currentShare").textContent = edgeCount && score !== null ? `${score}%` : "—";
  $("#currentBar").style.width = `${score || 0}%`;
  $("#licenseShare").textContent = packageCount ? `${licensePct}%` : "—";
  $("#licenseBar").style.width = `${licensePct}%`;

  const licenses = dashboardData?.licenseDistribution || [];
  const maxLicense = Math.max(1, ...licenses.map(item => item.count));
  const licenseDistribution = $("#licenseDistribution");
  licenseDistribution.innerHTML = licenses.map(item =>
    '<div class="license-distribution-row"><span>' + esc(item.license) + '</span><div class="license-distribution-track"><div class="license-distribution-fill"></div></div><strong>' + item.count + '</strong></div>'
  ).join("") || '<div class="empty-state">' + (apiConnected ? "No package license values recorded." : "Reconnect to DepGraph to load the license distribution.") + "</div>";
  licenses.forEach((item, index) => {
    licenseDistribution.querySelectorAll(".license-distribution-fill")[index].style.width = Math.round(item.count / maxLicense * 100) + "%";
  });

  $("#overviewProjects").innerHTML = projects.slice(0, 4).map(project => {
    const summary = stats(project);
    return '<tr><td><div class="project-cell"><span class="project-icon">' + esc(initials(project.name)) + '</span><div><div class="cell-main">' + esc(project.name) + '</div><div class="cell-sub">' + esc(project.owner || "Unassigned") + '</div></div></div></td><td>' + summary.total + ' dependencies</td><td><span class="health-pill ' + (summary.score === null ? "" : summary.score >= 80 ? "healthy" : "review") + '">' + esc(summary.health) + (summary.score === null ? "" : ' · ' + summary.score + '/100') + '</span></td><td>' + esc(ago(project.updatedAt)) + '</td></tr>';
  }).join("") || '<tr><td colspan="4" class="empty-state">' + (apiConnected ? "No projects in MongoDB yet." : "Reconnect to DepGraph to load projects.") + '</td></tr>';

  $("#overviewFindings").innerHTML = vulnerabilities.slice(0, 3).map(findingRow).join("") || '<div class="empty-state">' + (apiConnected ? "No recorded findings." : "Reconnect to DepGraph to load recorded findings.") + "</div>";
}
