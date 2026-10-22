import { api } from "./api.js";
import { $, options, toast } from "./helpers.js";
import {
  activeId,
  activeType,
  apiConnected,
  dependencies,
  packages,
  projects,
  vulnerabilities,
  setActiveRecord
} from "./state.js";

function projectFields() {
  return '<div class="form-field full"><label for="f-name">Project name</label><input id="f-name" name="name" required maxlength="80"></div><div class="form-field"><label for="f-owner">Owner / team</label><input id="f-owner" name="owner" maxlength="80"></div><div class="form-field"><label for="f-ecosystem">Primary ecosystem</label><input id="f-ecosystem" name="ecosystem" maxlength="40" placeholder="npm, PyPI, Maven…"></div><div class="form-field full"><label for="f-repository">Repository URL</label><input id="f-repository" name="repository" type="url" maxlength="300"></div><div class="form-field full"><label for="f-description">Description</label><textarea id="f-description" name="description" maxlength="500"></textarea></div>';
}

function packageFields(edit) {
  return '<div class="form-field"><label for="f-name">Package name</label><input id="f-name" name="name" required maxlength="120"></div><div class="form-field"><label for="f-version">Installed version</label><input id="f-version" name="version" required maxlength="60"></div><div class="form-field"><label for="f-comparisonVersion">Comparison version in dataset</label><input id="f-comparisonVersion" name="comparisonVersion" maxlength="60" placeholder="Optional; e.g. 1.2.3"></div><div class="form-field"><label for="f-ecosystem">Ecosystem</label><input id="f-ecosystem" name="ecosystem" required maxlength="40" placeholder="npm, PyPI, Maven"></div><div class="form-field"><label for="f-license">License</label><input id="f-license" name="license" maxlength="80"></div><div class="form-field full"><label for="f-description">Description</label><textarea id="f-description" name="description" maxlength="500"></textarea></div>' + (edit ? "" : '<div class="form-field full"><label for="f-projectId">Add to project</label><select id="f-projectId" name="projectId" required>' + options(projects) + '</select></div><div class="form-field"><label for="f-reviewStatus">Maintainer review label</label><select id="f-reviewStatus" name="reviewStatus"><option value="current">No review needed</option><option value="review">Needs review</option></select></div><div class="form-field"><label for="f-versionConstraint">Declared version range</label><input id="f-versionConstraint" name="versionConstraint" maxlength="100" placeholder="e.g. ^1.2.0"></div>');
}

function dependencyFields() {
  const packageOptions = options(packages, item => item.name + "@" + item.version + " · " + item.ecosystem);
  return '<div class="form-field full"><label for="f-projectId">Project</label><select id="f-projectId" name="projectId" required>' + options(projects) + '</select></div><div class="form-field"><label for="f-dependencyType">Relationship type</label><select id="f-dependencyType" name="dependencyType"><option value="direct">Direct</option><option value="transitive">Transitive</option></select></div><div class="form-field"><label for="f-reviewStatus">Version status</label><select id="f-reviewStatus" name="reviewStatus"><option value="current">Current</option><option value="review">Needs review</option></select></div><div class="form-field full"><label for="f-sourcePackageId">Source package (required for transitive links)</label><select id="f-sourcePackageId" name="sourcePackageId"><option value="">Project root</option>' + packageOptions + '</select></div><div class="form-field full"><label for="f-targetPackageId">Depends on package</label><select id="f-targetPackageId" name="targetPackageId" required>' + packageOptions + '</select></div><div class="form-field full"><label for="f-versionConstraint">Version constraint</label><input id="f-versionConstraint" name="versionConstraint" maxlength="100" placeholder="e.g. ^4.18.0"></div>';
}

function vulnerabilityFields() {
  return '<div class="form-field full"><label for="f-packageId">Package identity</label><select id="f-packageId" name="packageId" required>' + options(packages, item => item.name + "@" + item.version + " · " + item.ecosystem) + '</select></div><div class="form-field"><label for="f-identifier">Identifier</label><input id="f-identifier" name="identifier" required maxlength="100" placeholder="Advisory ID or DG-DEMO-…"></div><div class="form-field"><label for="f-severity">Severity</label><select id="f-severity" name="severity"><option>Critical</option><option>High</option><option selected>Medium</option><option>Low</option><option>Informational</option></select></div><div class="form-field"><label for="f-status">Status</label><select id="f-status" name="status"><option>Open</option><option>Resolved</option><option>Accepted</option></select></div><div class="form-field"><label for="f-verificationStatus">Evidence label</label><select id="f-verificationStatus" name="verificationStatus"><option value="unverified" selected>Unverified note</option><option value="sample">Sample data</option><option value="verified">User marked verified</option></select></div><div class="form-field"><label for="f-sourceUrl">Source URL (required if marked verified)</label><input id="f-sourceUrl" name="sourceUrl" type="url" maxlength="500"></div><div class="form-field full"><label for="f-affectedVersions">Affected versions or range</label><input id="f-affectedVersions" name="affectedVersions" required maxlength="200" placeholder="e.g. < 2.4.1, ^1.2.0, 1.2.x"></div><div class="form-field full"><label for="f-recommendedAction">Recommended action</label><textarea id="f-recommendedAction" name="recommendedAction" required maxlength="1000"></textarea></div><div class="form-field full"><label for="f-description">Description</label><textarea id="f-description" name="description" maxlength="1000"></textarea></div>';
}

function findRecord(type, id) {
  const records = type === "project" ? projects : type === "package" ? packages : type === "dependency" ? dependencies : vulnerabilities;
  return records.find(record => record.id === id);
}

export function openDialog(type, id = "") {
  if (!apiConnected) return toast("MongoDB is unavailable. Reconnect before editing records.");
  if (type === "package" && !id && !projects.length) return toast("Create a project first.");
  if ((type === "dependency" || type === "vulnerability") && !packages.length) return toast("Add a package record first.");

  const edit = Boolean(id);
  const record = edit ? findRecord(type, id) : null;
  if (edit && !record) return toast("Record not loaded. Refresh and try again.");
  setActiveRecord(type, id);
  const labels = { project: "project", package: "package", dependency: "dependency relationship", vulnerability: "vulnerability note" };
  $("#dialogTitle").textContent = (edit ? "Edit " : "Add ") + labels[type];
  $("#saveRecord").textContent = edit ? "Save changes" : "Create record";
  $("#formFields").innerHTML = type === "project" ? projectFields() : type === "package" ? packageFields(edit) : type === "dependency" ? dependencyFields() : vulnerabilityFields();
  $("#recordForm").reset();

  if (edit) {
    const values = type === "dependency"
      ? { projectId: record.projectId, sourcePackageId: record.sourcePackageId || "", targetPackageId: record.targetPackageId, dependencyType: record.dependencyType, reviewStatus: record.reviewStatus, versionConstraint: record.versionConstraint }
      : type === "vulnerability"
        ? { packageId: record.packageId, identifier: record.identifier, severity: record.severity, status: record.status, affectedVersions: record.affectedVersions, recommendedAction: record.recommendedAction, description: record.description, verificationStatus: record.verificationStatus || "unverified", sourceUrl: record.sourceUrl || "" }
        : record;
    for (const [key, value] of Object.entries(values || {})) {
      const field = $("#recordForm").elements.namedItem(key);
      if (field && value !== undefined && value !== null) field.value = value;
    }
  }

  $("#recordDialog").showModal();
  $("#formFields").querySelector("input,select,textarea")?.focus();
}

async function savePackage(data) {
  const body = { name: data.name, version: data.version, ecosystem: data.ecosystem, license: data.license, description: data.description, comparisonVersion: data.comparisonVersion || "" };
  if (activeId) return api("/api/packages/" + activeId, { method: "PUT", body: JSON.stringify(body) });

  let packageRecord = packages.find(item => item.name.toLowerCase() === data.name.toLowerCase() && item.version === data.version && item.ecosystem.toLowerCase() === data.ecosystem.toLowerCase());
  let created = false;
  if (!packageRecord) {
    packageRecord = await api("/api/packages", { method: "POST", body: JSON.stringify(body) });
    created = true;
  }

  try {
    const link = dependencies.find(item => item.projectId === data.projectId && item.targetPackageId === packageRecord.id && !item.sourcePackageId);
    if (link) {
      await api("/api/dependencies/" + link.id, { method: "PUT", body: JSON.stringify({ reviewStatus: data.reviewStatus, versionConstraint: data.versionConstraint || data.version }) });
      toast("Package was already in the project; its labels were updated.");
      return;
    }
    await api("/api/dependencies", { method: "POST", body: JSON.stringify({ projectId: data.projectId, targetPackageId: packageRecord.id, dependencyType: "direct", reviewStatus: data.reviewStatus, versionConstraint: data.versionConstraint || data.version }) });
  } catch (error) {
    if (created) await api("/api/packages/" + packageRecord.id, { method: "DELETE" }).catch(() => {});
    throw error;
  }
}

async function submitRecord(event, refresh) {
  event.preventDefault();
  if (!apiConnected) return toast("MongoDB is unavailable. Reconnect before saving.");
  const data = Object.fromEntries(new FormData(event.currentTarget).entries());

  try {
    if (activeType === "project") {
      await api(activeId ? "/api/projects/" + activeId : "/api/projects", {
        method: activeId ? "PUT" : "POST",
        body: JSON.stringify({ name: data.name, description: data.description, ecosystem: data.ecosystem, owner: data.owner, repository: data.repository })
      });
    } else if (activeType === "package") {
      await savePackage(data);
    } else if (activeType === "dependency") {
      await api(activeId ? "/api/dependencies/" + activeId : "/api/dependencies", {
        method: activeId ? "PUT" : "POST",
        body: JSON.stringify({ ...data, sourcePackageId: data.sourcePackageId || null })
      });
    } else {
      await api(activeId ? "/api/vulnerabilities/" + activeId : "/api/vulnerabilities", {
        method: activeId ? "PUT" : "POST",
        body: JSON.stringify(data)
      });
    }

    const wasEdit = Boolean(activeId);
    $("#recordDialog").close();
    await refresh();
    toast(wasEdit ? "Changes saved to MongoDB" : "Record saved to MongoDB");
  } catch (error) {
    toast(error.message);
  }
}

export async function removeRecord(type, id, refresh) {
  if (!apiConnected) return toast("MongoDB is unavailable. Reconnect before deleting records.");
  const detail = type === "project" ? " Its dependency relationships will also be removed." : type === "package" ? " Its dependency relationships and vulnerability notes will also be removed." : "";
  if (!confirm("Delete this " + type + "?" + detail)) return;
  const endpoint = { project: "projects", package: "packages", dependency: "dependencies", vulnerability: "vulnerabilities" }[type];
  try {
    await api("/api/" + endpoint + "/" + id, { method: "DELETE" });
    await refresh();
    toast(type[0].toUpperCase() + type.slice(1) + " deleted");
  } catch (error) {
    toast(error.message);
  }
}

export function initForms(refresh) {
  $("#recordForm").addEventListener("submit", event => void submitRecord(event, refresh));
  $(".dialog-close").addEventListener("click", () => $("#recordDialog").close());
  $("#cancelDialog").addEventListener("click", () => $("#recordDialog").close());
  $("#recordDialog").addEventListener("click", event => {
    if (event.target === event.currentTarget) event.currentTarget.close();
  });
}
