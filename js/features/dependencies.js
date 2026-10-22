import { apiConnected, dependencies } from "../state.js";
import { $, esc, versionPill } from "../helpers.js";

export function renderDependencies() {
  if (!$("#dependencyRows")) return;
  const rows = dependencies.map(dependency => {
    const target = dependency.targetPackage || {};
    const intelligence = dependency.versionIntelligence || {};
    return '<tr><td>' + esc(dependency.project?.name || "Unknown project") + '</td><td>' + esc(dependency.sourcePackage?.name || "Project root") + '</td><td>' + esc(target.name || "Missing package") + ' <span class="cell-sub">' + esc(target.version || "") + '</span></td><td>' + esc(dependency.dependencyType) + '</td><td>' + esc(dependency.versionConstraint || "—") + '</td><td>' + versionPill(intelligence) + '</td><td><span class="status-pill ' + (dependency.reviewStatus === "review" ? "outdated" : "current") + '">' + (dependency.reviewStatus === "review" ? "Needs review" : "No review label") + '</span></td><td><div class="row-actions"><button class="small-action" data-record-action data-edit="dependency" data-id="' + esc(dependency.id) + '">Edit</button><button class="small-action danger" data-record-action data-delete="dependency" data-id="' + esc(dependency.id) + '">Delete</button></div></td></tr>';
  }).join("");
  $("#dependencyRows").innerHTML = rows || '<tr><td colspan="8" class="empty-state">' + (apiConnected ? "No dependency relationships recorded." : "Dependency records are hidden until the API reconnects.") + "</td></tr>";
}
