export const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
export const views = { overview: "Overview", projects: "Projects", dependencies: "Dependencies", vulnerabilities: "Vulnerabilities", reports: "Reports" };

export let projects = [];
export let packages = [];
export let dependencies = [];
export let vulnerabilities = [];
export let dashboardData = null;
export let graphData = null;
export let graphProjectId = "";
export let graphSelectedPackageId = "";
export let apiConnected = false;
export let toastTimer = null;
export let activeType = "";
export let activeId = "";

export function setRecords(next) {
  projects = next.projects;
  packages = next.packages;
  dependencies = next.dependencies;
  vulnerabilities = next.vulnerabilities;
  dashboardData = next.dashboardData;
}

export function setApiConnected(connected) {
  apiConnected = connected;
}

export function setGraphData(data) {
  graphData = data;
}

export function setGraphSelection(projectId, packageId = "") {
  graphProjectId = projectId;
  graphSelectedPackageId = packageId;
}

export function setGraphSelectedPackageId(packageId) {
  graphSelectedPackageId = packageId;
}

export function setToastTimer(timer) {
  toastTimer = timer;
}

export function setActiveRecord(type, id = "") {
  activeType = type;
  activeId = id;
}
