import { apiConnected, projects } from "../state.js";
import { $, esc, initials, stats } from "../helpers.js";

export function renderProjects() {
  $("#projectGrid").innerHTML = projects.map(project => {
    const summary = stats(project);
    return '<article class="project-tile"><div class="project-tile-top"><span class="project-icon">' + esc(initials(project.name)) + '</span><div><h3>' + esc(project.name) + '</h3><div class="cell-sub">' + esc(project.owner || "Unassigned") + '</div></div></div><p>' + esc(project.description || "No description added yet.") + '</p><div class="tile-meta"><span><strong>' + summary.total + '</strong> links · ' + summary.behind + ' behind comparison</span><span class="health-pill ' + (summary.score === null ? "" : summary.score >= 80 ? "healthy" : "review") + '">' + esc(summary.health) + (summary.score === null ? "" : ' · ' + summary.score + '/100') + '</span></div><div class="cell-sub project-risk-summary">' + summary.affected + ' dependency links match an open affected-version note.</div><div class="tile-actions"><button class="small-action" data-record-action data-edit="project" data-id="' + esc(project.id) + '">Edit</button><button class="small-action danger" data-record-action data-delete="project" data-id="' + esc(project.id) + '">Delete</button></div></article>';
  }).join("") || '<div class="empty-state">' + (apiConnected ? "No projects yet. Create your first project to get started." : "Project records are hidden until the API reconnects.") + "</div>";
}
