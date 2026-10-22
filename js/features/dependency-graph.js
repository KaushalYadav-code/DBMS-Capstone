import { api } from "../api.js";
import {
  apiConnected,
  graphData,
  graphProjectId,
  graphSelectedPackageId,
  projects,
  setGraphData,
  setGraphSelectedPackageId,
  setGraphSelection
} from "../state.js";
import { $, comparisonLabel, esc, options } from "../helpers.js";

export function syncGraphControls() {
  const projectSelect = $("#graphProject");
  const packageSelect = $("#graphPackage");
  if (!projectSelect || !packageSelect) return;

  if (!apiConnected || !projects.length) {
    projectSelect.innerHTML = '<option value="">No projects available</option>';
    packageSelect.innerHTML = '<option value="">Select a package</option>';
    setGraphData(null);
    setGraphSelection("", "");
    renderGraph();
    return;
  }

  const previous = graphProjectId || projectSelect.value;
  projectSelect.innerHTML = options(projects, project => project.name);
  const chosen = projects.some(project => project.id === previous) ? previous : projects[0].id;
  projectSelect.value = chosen;
  if (chosen !== graphProjectId || !graphData || graphData.project?.id !== chosen) {
    void loadGraph(chosen, chosen === graphProjectId ? graphSelectedPackageId : "");
  }
}

function syncGraphPackageOptions() {
  const select = $("#graphPackage");
  if (!select) return;
  const nodes = (graphData?.nodes || []).filter(node => node.kind === "package");
  const selectedIsValid = nodes.some(node => node.packageId === graphSelectedPackageId);
  if (!selectedIsValid) setGraphSelectedPackageId("");
  select.innerHTML = '<option value="">Select a package</option>' + nodes.map(node =>
    '<option value="' + esc(node.packageId) + '">' + esc(node.package.name + '@' + node.package.version + ' · ' + node.package.ecosystem) + '</option>'
  ).join("");
  select.value = graphSelectedPackageId;
}

export async function loadGraph(projectId, packageId = "") {
  if (!projectId || !apiConnected) {
    setGraphData(null);
    renderGraph();
    return;
  }

  setGraphSelection(projectId, packageId);
  const query = new URLSearchParams({ projectId });
  if (packageId) query.set("packageId", packageId);
  $("#graphDetails").innerHTML = '<div class="empty-state">Loading dependency graph from MongoDB…</div>';
  try {
    const result = await api("/api/graph?" + query.toString());
    if ($("#graphProject").value !== projectId) return;
    setGraphData(result);
    syncGraphPackageOptions();
    renderGraph();
  } catch (error) {
    setGraphData(null);
    $("#dependencyGraph").innerHTML = "";
    $("#graphDetails").innerHTML = '<div class="empty-state">' + esc(error.message) + '</div>';
  }
}

export function selectGraphPackage(packageId) {
  setGraphSelectedPackageId(packageId);
  const select = $("#graphPackage");
  if (select) select.value = packageId;
  void loadGraph(graphProjectId, packageId);
}

export function renderGraph() {
  const svg = $("#dependencyGraph");
  const details = $("#graphDetails");
  if (!svg || !details) return;
  if (!graphData) {
    svg.innerHTML = "";
    details.innerHTML = '<div class="empty-state">' + (apiConnected ? "Choose a project to load its dependency graph." : "Reconnect to DepGraph to load dependency records.") + '</div>';
    return;
  }

  const nodes = graphData.nodes || [];
  const edges = graphData.edges || [];
  const root = nodes.find(node => node.kind === "project");
  if (!root) {
    svg.innerHTML = "";
    details.innerHTML = '<div class="empty-state">This project has no graph root.</div>';
    return;
  }

  const depth = new Map([[root.id, 0]]);
  const queue = [root.id];
  const outgoing = new Map();
  for (const edge of edges) {
    const list = outgoing.get(edge.source) || [];
    list.push(edge.target);
    outgoing.set(edge.source, list);
  }
  for (let index = 0; index < queue.length; index++) {
    const from = queue[index];
    for (const target of outgoing.get(from) || []) {
      if (!depth.has(target)) {
        depth.set(target, (depth.get(from) || 0) + 1);
        queue.push(target);
      }
    }
  }

  const packagesAtDepth = new Map();
  for (const node of nodes.filter(item => item.kind === "package")) {
    const level = depth.get(node.id) || 1;
    const list = packagesAtDepth.get(level) || [];
    list.push(node);
    packagesAtDepth.set(level, list);
  }
  for (const list of packagesAtDepth.values()) list.sort((a, b) => a.label.localeCompare(b.label));

  const maxDepth = Math.max(1, ...packagesAtDepth.keys());
  const maxRows = Math.max(1, ...[...packagesAtDepth.values()].map(list => list.length));
  const width = 220 + maxDepth * 230;
  const height = Math.max(300, maxRows * 105 + 75);
  const nodeWidth = 190;
  const nodeHeight = 66;
  const positions = new Map([[root.id, { x: 24, y: height / 2 - nodeHeight / 2 }]]);
  for (const [level, list] of packagesAtDepth) {
    const start = height / 2 - (list.length * 105) / 2;
    list.forEach((node, index) => positions.set(node.id, { x: 24 + level * 230, y: start + index * 105 }));
  }

  const packageMap = new Map(nodes.filter(node => node.kind === "package").map(node => [node.packageId, node]));
  const edgeMarkup = edges.map(edge => {
    const from = positions.get(edge.source);
    const to = positions.get(edge.target);
    if (!from || !to) return "";
    const forward = to.x >= from.x;
    const sourceX = from.x + (forward ? nodeWidth : 0);
    const targetX = to.x + (forward ? 0 : nodeWidth);
    const sourceY = from.y + nodeHeight / 2;
    const targetY = to.y + nodeHeight / 2;
    const curve = Math.max(35, Math.abs(targetX - sourceX) * 0.45);
    const status = edge.versionIntelligence?.behindComparison ? " behind" : "";
    const review = edge.reviewStatus === "review" ? " review" : "";
    const target = packageMap.get(edge.targetPackageId);
    const vulnerable = target?.vulnerabilities?.some(item => item.matchStatus === "affected" && item.status !== "Resolved" && item.status !== "Accepted") ? " vulnerable" : "";
    return '<path class="graph-edge' + status + review + vulnerable + '" d="M ' + sourceX + ' ' + sourceY + ' C ' + (sourceX + (forward ? curve : -curve)) + ' ' + sourceY + ', ' + (targetX - (forward ? curve : -curve)) + ' ' + targetY + ', ' + targetX + ' ' + targetY + '"><title>' + esc(edge.versionConstraint || "No declared range") + '</title></path>';
  }).join("");

  const selected = graphSelectedPackageId;
  const nodeMarkup = nodes.map(node => {
    const position = positions.get(node.id);
    if (!position) return "";
    const packageRecord = node.package || {};
    const intelligence = node.versionIntelligence || {};
    const behind = intelligence.state === "behind-comparison";
    const vulnerable = (node.vulnerabilities || []).some(item => item.matchStatus === "affected" && item.status !== "Resolved" && item.status !== "Accepted");
    const className = node.kind === "project" ? "project" : (behind ? "behind" : "") + (vulnerable ? " vulnerable" : "") + (selected === node.packageId ? " selected" : "");
    const rawLabel = String(node.label || "");
    const label = rawLabel.length > 24 ? rawLabel.slice(0, 22) + "…" : rawLabel;
    const meta = node.kind === "project" ? "Project root" : behind ? packageRecord.version + " → " + intelligence.comparisonVersion : intelligence.state === "at-or-above-comparison" ? "At or above " + intelligence.comparisonVersion : "No comparison version";
    const interactive = node.kind === "package"
      ? 'role="button" tabindex="0" data-graph-package="' + esc(node.packageId) + '" aria-label="Select ' + esc(packageRecord.name + " " + packageRecord.version) + '"'
      : 'role="img"';
    const title = node.kind === "project" ? node.label : packageRecord.name + "@" + packageRecord.version + " · " + packageRecord.ecosystem;
    return '<g class="graph-node ' + className + '" ' + interactive + '><title>' + esc(title) + '</title><rect x="' + position.x + '" y="' + position.y + '" width="' + nodeWidth + '" height="' + nodeHeight + '" rx="10"/><text class="graph-label" x="' + (position.x + 12) + '" y="' + (position.y + 25) + '">' + esc(label) + '</text><text class="graph-meta" x="' + (position.x + 12) + '" y="' + (position.y + 46) + '">' + esc(meta) + '</text></g>';
  }).join("");

  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  svg.setAttribute("width", width);
  svg.setAttribute("height", height);
  svg.innerHTML = '<defs><marker id="graphArrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 z" fill="#9da8be"/></marker></defs>' + edgeMarkup + nodeMarkup;

  const selectedNode = nodes.find(node => node.packageId === selected);
  const directDependencies = selected ? edges.filter(edge => edge.sourcePackageId === selected) : [];
  const directDependents = selected ? edges.filter(edge => edge.targetPackageId === selected && edge.sourcePackageId) : [];
  const membership = selected ? edges.filter(edge => edge.source === root.id && edge.targetPackageId === selected) : [];
  const renderList = (items, empty) => items.length ? '<ul>' + items.map(item => '<li class="graph-detail-item">' + esc(item) + '</li>').join("") + '</ul>' : '<p>' + esc(empty) + '</p>';

  if (!selectedNode) {
    details.innerHTML = '<div class="graph-detail-group"><h3>Project graph</h3><p>' + nodes.filter(node => node.kind === "package").length + ' package nodes · ' + edges.length + ' stored links. Select a package node or use the package selector.</p></div><div class="graph-detail-group"><h3>Reading the graph</h3><p>Arrows point from project or source package to the package it depends on. Amber marks a stored comparison gap; red marks an open note whose stored affected range includes the installed version.</p></div>';
    return;
  }

  const packageRecord = selectedNode.package || {};
  const intelligence = selectedNode.versionIntelligence || {};
  const findings = selectedNode.vulnerabilities || [];
  const activeFindings = findings.filter(item => item.status !== "Resolved" && item.status !== "Accepted");
  const dependencyNames = directDependencies.map(edge => {
    const target = packageMap.get(edge.targetPackageId)?.package || {};
    return target.name + "@" + target.version + (edge.versionConstraint ? " · " + edge.versionConstraint : "");
  });
  const dependentNames = directDependents.map(edge => {
    const source = packageMap.get(edge.sourcePackageId)?.package || {};
    return source.name + "@" + source.version;
  });
  const declaredRanges = membership.map(edge => edge.versionConstraint || "No declared range");
  const findingNames = activeFindings.map(item => item.identifier + " · " + item.severity + " · " + item.matchStatus + " · " + (item.verificationStatus === "sample" ? "sample data" : item.verificationStatus === "verified" ? "user marked verified" : "unverified note"));
  details.innerHTML = '<div class="graph-detail-group"><h3>' + esc(packageRecord.name) + '@' + esc(packageRecord.version) + ' · ' + esc(packageRecord.ecosystem) + '</h3><p>' + esc(comparisonLabel({ versionIntelligence: intelligence })) + (intelligence.comparisonVersion ? ' (' + esc(intelligence.comparisonVersion) + ')' : "") + '</p><p>Declared project range: ' + esc(declaredRanges.join(", ") || "No direct project link") + '</p></div><div class="graph-detail-group"><h3>Direct dependencies · ' + directDependencies.length + '</h3>' + renderList(dependencyNames, "No package-to-package dependencies are stored for this package.") + '</div><div class="graph-detail-group"><h3>Direct dependents · ' + directDependents.length + '</h3>' + renderList(dependentNames, "No package in this project directly depends on the selected package.") + '</div><div class="graph-detail-group"><h3>Matched vulnerability notes · ' + activeFindings.length + '</h3>' + renderList(findingNames, "No open stored notes match this package identity.") + '</div>';
}
