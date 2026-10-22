import { apiConnected, packages } from "../state.js";
import { $, comparisonState, esc, pkgProjects, pkgStatus, versionPill } from "../helpers.js";

export function filteredPackages() {
  if (!apiConnected) return [];
  const query = $("#packageSearch").value.trim().toLowerCase();
  const ecosystem = $("#ecosystemFilter").value;
  const status = $("#statusFilter").value;
  return packages.filter(packageRecord => {
    const review = pkgStatus(packageRecord);
    const comparison = comparisonState(packageRecord);
    const haystack = [packageRecord.name, packageRecord.description, pkgProjects(packageRecord), packageRecord.license, packageRecord.ecosystem, packageRecord.version, packageRecord.comparisonVersion].join(" ").toLowerCase();
    return haystack.includes(query) && (ecosystem === "all" || packageRecord.ecosystem === ecosystem) &&
      (status === "all" || (status === "behind-comparison" ? comparison === "behind-comparison" : status === "review" ? review === "review" : status === "unknown" ? comparison === "unknown" : true));
  });
}

export function renderPackages() {
  if (!$("#packageRows")) return;
  const rows = filteredPackages();
  $("#packageRows").innerHTML = rows.map(packageRecord => {
    const review = pkgStatus(packageRecord);
    const intelligence = packageRecord.versionIntelligence || {};
    return '<tr><td><div class="package-cell"><span class="package-mark ' + (packageRecord.ecosystem === "PyPI" ? "py" : "") + '">' + (packageRecord.ecosystem === "PyPI" ? "Py" : "JS") + '</span><div><div class="cell-main">' + esc(packageRecord.name) + '</div><div class="cell-sub">' + esc(packageRecord.description || "Package record") + '</div></div></div></td><td>' + esc(packageRecord.version) + (intelligence.comparisonVersion ? '<span class="version-detail">Compare ' + esc(intelligence.comparisonVersion) + '</span>' : "") + '</td><td>' + esc(packageRecord.ecosystem) + '</td><td><span class="license-pill">' + esc(packageRecord.license || "Unspecified") + '</span></td><td>' + esc(pkgProjects(packageRecord)) + '</td><td>' + versionPill(intelligence) + (review === "review" ? '<span class="version-detail">Maintainer marked for review</span>' : review === "unassigned" ? '<span class="version-detail">Not linked to a project</span>' : "") + '</td><td><div class="row-actions"><button class="small-action" data-record-action data-edit="package" data-id="' + esc(packageRecord.id) + '">Edit</button><button class="small-action danger" data-record-action data-delete="package" data-id="' + esc(packageRecord.id) + '">Delete</button></div></td></tr>';
  }).join("") || '<tr><td colspan="7" class="empty-state">' + (apiConnected ? "No matching packages. Adjust your search or filters." : "Package records are hidden until the API reconnects.") + "</td></tr>";
  $("#packageResultCount").textContent = apiConnected ? `Showing ${rows.length} of ${packages.length} records` : "Data unavailable";
}
