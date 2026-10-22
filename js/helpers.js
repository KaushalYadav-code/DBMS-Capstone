import { dashboardData, dependencies, setToastTimer, toastTimer } from "./state.js";

export const $ = (selector, root = document) => root.querySelector(selector);
export const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

export function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, character => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[character]);
}

export function initials(name) {
  return String(name || "DG").trim().split(/\s+/).slice(0, 2).map(part => part[0] || "").join("").toUpperCase();
}

export function ago(date) {
  if (!date) return "Recently";
  const days = Math.floor(Math.max(0, Date.now() - new Date(date).getTime()) / 86400000);
  return !Number.isFinite(days) || days === 0 ? "Today" : days === 1 ? "Yesterday" : `${days} days ago`;
}

export function stats(project) {
  const summary = dashboardData?.projects?.find(item => item.projectId === project.id);
  const rows = dependencies.filter(item => item.projectId === project.id);
  const old = summary?.needsReview ?? rows.filter(item => item.reviewStatus === "review").length;
  const score = summary?.healthScore ?? null;
  return {
    total: summary?.dependencyCount ?? rows.length,
    old,
    behind: summary?.behindComparison ?? 0,
    affected: summary?.affectedDependencies ?? 0,
    score,
    health: score === null ? "Not assessed" : score >= 80 ? "Healthy" : score >= 50 ? "Review" : "Attention"
  };
}

export function pkgStatus(packageRecord) {
  const assignments = packageRecord.projects || [];
  return assignments.some(item => item.reviewStatus === "review") ? "review" : assignments.length ? "current" : "unassigned";
}

export function comparisonState(packageRecord) {
  return packageRecord.versionIntelligence?.state || "unknown";
}

export function comparisonLabel(packageRecord) {
  const status = comparisonState(packageRecord);
  return status === "behind-comparison" ? "Behind recorded comparison" : status === "at-or-above-comparison" ? "At or above recorded comparison" : "No comparison data";
}

export function versionPill(info) {
  const state = info?.state || "unknown";
  const label = state === "behind-comparison"
    ? info.constraintState === "allows-comparison" ? "Behind · range allows" : info.constraintState === "blocks-comparison" ? "Behind · range blocks" : "Behind comparison"
    : state === "at-or-above-comparison" ? "At or above recorded comparison" : "Insufficient version data";
  return `<span class="status-pill ${state === "behind-comparison" ? "outdated" : state === "unknown" ? "unknown" : "current"}">${esc(label)}</span>` +
    (info?.comparisonVersion ? `<span class="version-detail">${esc(info.installedVersion)} → ${esc(info.comparisonVersion)}${info.constraint ? ` · ${esc(info.constraint)}` : ""}</span>` : "");
}

export function pkgProjects(packageRecord) {
  return (packageRecord.projects || []).map(item => item.projectName).filter(Boolean).join(", ") || "Not assigned";
}

export function metric(label, value, note, icon, tone, className = "") {
  return `<article class="card metric-card"><div class="metric-top"><span class="metric-label">${esc(label)}</span><span class="metric-icon ${tone}"><svg fill="none" stroke="currentColor" stroke-width="1.8"><use href="#${icon}"/></svg></span></div><div class="metric-value">${value}</div><div class="metric-foot"><span class="${className}">${esc(note)}</span></div></article>`;
}

export function options(rows, label = item => item.name) {
  return rows.map(item => `<option value="${esc(item.id)}">${esc(label(item))}</option>`).join("");
}

export function toast(message) {
  const element = $("#toast");
  element.textContent = message;
  element.classList.add("visible");
  clearTimeout(toastTimer);
  setToastTimer(setTimeout(() => element.classList.remove("visible"), 3200));
}
