import { apiConnected, dashboardData } from "../state.js";
import { $, esc } from "../helpers.js";

export function renderHealthAnalytics() {
  const rows = dashboardData?.projects || [];
  $("#healthFormula").textContent = dashboardData?.health?.formula || "Health score is unavailable until DepGraph reconnects to MongoDB.";
  $("#healthRows").innerHTML = rows.map(project =>
    '<tr><td>' + esc(project.projectName) + '</td><td>' + project.dependencyCount + '</td><td>' + project.needsReview + '</td><td>' + project.behindComparison + '</td><td>' + project.affectedDependencies + '</td><td>' + (project.healthScore === null ? "Not assessed" : project.healthScore + "/100") + '</td></tr>'
  ).join("") || '<tr><td colspan="6" class="empty-state">' + (apiConnected ? "No project analytics to display." : "Reconnect to DepGraph to load project analytics.") + "</td></tr>";

  const note = $(".health-card .card-note");
  const current = $(".health-breakdown .health-row span");
  if (note) note.textContent = "Based on stored labels, comparisons, and matched notes";
  if (current) current.textContent = "Links without tracked risk";
}
