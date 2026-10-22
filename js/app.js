import { api } from "./api.js";
import { exportPackages, exportProjects, exportVulnerabilities } from "./csv.js";
import { renderDashboard } from "./features/dashboard.js";
import { renderDependencies } from "./features/dependencies.js";
import { loadGraph, selectGraphPackage, syncGraphControls } from "./features/dependency-graph.js";
import { renderPackages } from "./features/packages.js";
import { renderProjects } from "./features/projects.js";
import { renderHealthAnalytics } from "./features/reports.js";
import { renderVulnerabilities } from "./features/vulnerabilities.js";
import { initForms, openDialog, removeRecord } from "./forms.js";
import { $, $$, esc, toast } from "./helpers.js";
import {
  apiConnected,
  months,
  setApiConnected,
  setGraphData,
  setGraphSelectedPackageId,
  setRecords,
  views
} from "./state.js";

let initialized = false;

function mode(connected, error = "") {
  setApiConnected(connected);
  const badge = $("#connectionBadge");
  const connecting = error === "Connecting… ";
  const mongoUnavailable = /MongoDB/i.test(error);
  badge.textContent = connected ? "MongoDB connected" : connecting ? "Connecting" : mongoUnavailable ? "MongoDB unavailable" : "API unavailable";
  badge.classList.toggle("connected", connected);

  for (const id of ["overviewDataBanner", "projectsDataBanner", "dependenciesDataBanner", "vulnerabilitiesDataBanner", "reportsDataBanner"]) {
    const element = document.getElementById(id);
    if (!element) continue;
    element.classList.toggle("api-unavailable", !connected && error !== "Connecting… ");
    const message = connected
      ? id === "vulnerabilitiesDataBanner"
        ? "<strong>Recorded notes.</strong> Matches use stored identities and ranges; DepGraph does not run live scans or verify advisories."
        : id === "dependenciesDataBanner"
          ? "Version comparisons use only versions recorded in this dataset. They are not registry lookups."
          : "Records are loaded from MongoDB and saved through the local DepGraph API."
      : connecting
        ? "Connecting to the local DepGraph API…"
        : `<strong>${mongoUnavailable ? "MongoDB data is unavailable." : "DepGraph API is unavailable."}</strong> ` + esc(error || "Start the DepGraph server and retry.") + ' <button class="banner-retry" data-action="retry">Retry</button>';
    element.lastElementChild.innerHTML = message;
  }

  updateControls();
}

function updateControls() {
  $$("[data-open]").forEach(element => { element.disabled = !apiConnected; });
  $$('[data-action^="export-"]').forEach(element => { element.disabled = !apiConnected; });
  $$("[data-record-action]").forEach(element => { element.disabled = !apiConnected; });
}

function render() {
  renderDashboard();
  renderProjects();
  renderPackages();
  renderDependencies();
  renderVulnerabilities();
  renderHealthAnalytics();
  syncGraphControls();
  updateControls();
}

async function refresh() {
  mode(false, "Connecting… ");
  try {
    const health = await api("/api/health");
    if (!health.ok || health.database !== "connected") {
      throw new Error("MongoDB is not connected. Start the MongoDB service and retry.");
    }

    const [projects, packages, dependencies, vulnerabilities, dashboardData] = await Promise.all([
      api("/api/projects?limit=500"),
      api("/api/packages?limit=500"),
      api("/api/dependencies?limit=500"),
      api("/api/vulnerabilities?limit=500"),
      api("/api/dashboard")
    ]);
    setRecords({ projects, packages, dependencies, vulnerabilities, dashboardData });
    mode(true);
    render();
  } catch (error) {
    setRecords({ projects: [], packages: [], dependencies: [], vulnerabilities: [], dashboardData: null });
    setGraphData(null);
    mode(false, error.message);
    render();
  }
}

function setView(name) {
  if (!views[name]) return;
  $$(".view").forEach(view => view.classList.toggle("active", view.id === "view-" + name));
  $$(".nav-item[data-view]").forEach(button => button.classList.toggle("active", button.dataset.view === name));
  $("#breadcrumbCurrent").textContent = views[name];
  document.title = "DepGraph — " + views[name];
  window.scrollTo({ top: 0, behavior: "smooth" });
  if (name === "dependencies") syncGraphControls();
}

function init() {
  if (initialized) return;
  initialized = true;

  const date = new Date();
  $("#todayLabel").textContent = months[date.getMonth()] + " " + date.getDate() + ", " + date.getFullYear();

  $("#packageSearch").addEventListener("input", renderPackages);
  $("#ecosystemFilter").addEventListener("change", renderPackages);
  $("#statusFilter").addEventListener("change", renderPackages);
  $("#graphProject").addEventListener("change", event => {
    setGraphSelectedPackageId("");
    void loadGraph(event.target.value);
  });
  $("#graphPackage").addEventListener("change", event => void loadGraph($("#graphProject").value, event.target.value));

  $$(".nav-item[data-view]").forEach(button => {
    button.addEventListener("click", () => setView(button.dataset.view));
  });
  $$('[data-action="export-packages"]').forEach(button => button.addEventListener("click", exportPackages));
  $$('[data-action="export-vulnerabilities"]').forEach(button => button.addEventListener("click", exportVulnerabilities));
  $$('[data-action="export-projects"]').forEach(button => button.addEventListener("click", exportProjects));

  document.addEventListener("click", event => {
    const graphNode = event.target.closest("[data-graph-package]");
    if (graphNode) {
      selectGraphPackage(graphNode.dataset.graphPackage);
      return;
    }
    const retry = event.target.closest('[data-action="retry"]');
    if (retry) {
      void refresh();
      return;
    }
    const open = event.target.closest("[data-open]");
    if (open) {
      openDialog(open.dataset.open);
      return;
    }
    const edit = event.target.closest("[data-edit]");
    if (edit) {
      openDialog(edit.dataset.edit, edit.dataset.id);
      return;
    }
    const remove = event.target.closest("[data-delete]");
    if (remove) {
      void removeRecord(remove.dataset.delete, remove.dataset.id, refresh);
      return;
    }
    const link = event.target.closest("[data-view-link]");
    if (link) setView(link.dataset.viewLink);
  });

  document.addEventListener("keydown", event => {
    const graphNode = event.target.closest("[data-graph-package]");
    if (graphNode && (event.key === "Enter" || event.key === " ")) {
      event.preventDefault();
      selectGraphPackage(graphNode.dataset.graphPackage);
    }
  });

  initForms(refresh);
  $("#notificationButton").addEventListener("click", () => toast("Notifications are not connected in this prototype."));
  $("#settingsButton").addEventListener("click", () => toast("Workspace settings are not part of this prototype."));

  mode(false, "Connecting… ");
  render();
  void refresh();
}

init();

