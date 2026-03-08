import "./styles/global.css";
import {
  parseLocalStorage,
  extractTitleInfo,
} from "../../utils/storage-parser";
import { exportToJson, downloadBlob } from "../../utils/json-handler";
import { filterRaw } from "../../utils/raw-filter";
import type { AnimeSamaData } from "../../utils/types";

type TypeFilter = "all" | "anime" | "scan" | "film";

interface TitlePreview {
  titleSlug: string;
  displayName: string;
  entries: Array<{
    type: string;
    language: string;
    detail: string;
  }>;
}

let currentData: AnimeSamaData | null = null;
let currentDomain = "";
let excludedTitles = new Set<string>();

function getActiveTypeFilter(): TypeFilter {
  const active = document.querySelector(
    "#type-filter .filter-btn.active",
  ) as HTMLElement | null;
  return (active?.dataset.type as TypeFilter) || "all";
}

function matchesType(type: string, filter: TypeFilter): boolean {
  if (filter === "all") return true;
  if (filter === "scan") return type === "scan";
  if (filter === "film") return type === "film";
  return type !== "scan" && type !== "film";
}

function init() {
  document
    .getElementById("btn-export")!
    .addEventListener("click", handleExport);
  document
    .getElementById("btn-import")!
    .addEventListener("click", handleImport);
  setupTypeFilter();
  loadData();
}

function setupTypeFilter() {
  const filterBar = document.getElementById("type-filter")!;
  filterBar.addEventListener("click", (e) => {
    const btn = (e.target as HTMLElement).closest(
      ".filter-btn",
    ) as HTMLElement | null;
    if (!btn) return;
    const type = btn.dataset.type as TypeFilter;
    if (type === getActiveTypeFilter()) return;
    excludedTitles = new Set<string>();
    filterBar
      .querySelectorAll(".filter-btn")
      .forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    updateTitleList();
  });
}

async function loadData() {
  const statusEl = document.getElementById("status")!;
  try {
    const [tab] = await browser.tabs.query({
      active: true,
      currentWindow: true,
    });
    if (tab?.url) {
      const url = new URL(tab.url);
      currentDomain = url.hostname;
    }

    const response = await browser.runtime.sendMessage({
      type: "GET_ALL_STORAGE",
    });

    if (response?.error) {
      currentData = null;
      updateStatus(statusEl, false);
      showErrorState(response.error);
    } else if (response?.data && Object.keys(response.data).length > 0) {
      currentData = parseLocalStorage(response.data, currentDomain);
      updateStatus(statusEl, true);
      updateSummary();
      document.getElementById("type-filter")!.style.display = "";
      updateTitleList();
      document.getElementById("btn-export")!.removeAttribute("disabled");
    } else {
      currentData = null;
      updateStatus(statusEl, false);
      showEmptyState();
    }
  } catch {
    currentData = null;
    updateStatus(statusEl, false);
    showErrorState("Content script not available. Try reloading the page.");
  }
}

function updateStatus(el: HTMLElement, connected: boolean) {
  const dot = el.querySelector(".status-dot") as HTMLElement;
  const text = el.querySelector(".status-text") as HTMLElement;
  if (connected) {
    dot.classList.add("connected");
    text.textContent = currentDomain;
  } else {
    dot.classList.add("disconnected");
    text.textContent = "No data found";
  }
}

function updateSummary() {
  if (!currentData) return;
  const summary = document.getElementById("summary")!;
  summary.style.display = "";
  document.getElementById("count-history")!.textContent = String(
    currentData.history.length,
  );
  document.getElementById("count-watchlist")!.textContent = String(
    currentData.watchlist.length,
  );
  document.getElementById("count-favorites")!.textContent = String(
    currentData.favorites.length,
  );
}

function buildTitlePreviews(): TitlePreview[] {
  if (!currentData) return [];

  const typeFilter = getActiveTypeFilter();
  const titleMap = new Map<
    string,
    { displayName: string; entries: TitlePreview["entries"] }
  >();

  for (const p of currentData.progress) {
    if (!matchesType(p.type, typeFilter)) continue;
    if (!titleMap.has(p.titleSlug)) {
      titleMap.set(p.titleSlug, {
        displayName: capitalize(p.titleSlug.replace(/-/g, " ")),
        entries: [],
      });
    }
    titleMap.get(p.titleSlug)!.entries.push({
      type: p.type,
      language: p.language,
      detail: p.episodeName || p.chapterName || "\u2014",
    });
  }

  for (const h of currentData.history) {
    const info = extractTitleInfo(h.url);
    if (!info) continue;
    if (!matchesType(info.type, typeFilter)) continue;
    if (!titleMap.has(info.titleSlug)) {
      titleMap.set(info.titleSlug, {
        displayName: h.name || capitalize(info.titleSlug.replace(/-/g, " ")),
        entries: [],
      });
    }
    const group = titleMap.get(info.titleSlug)!;
    if (
      !group.displayName ||
      group.displayName === capitalize(info.titleSlug.replace(/-/g, " "))
    ) {
      if (h.name) group.displayName = h.name;
    }
    const alreadyHasEntry = group.entries.some(
      (e) => e.type === info.type && e.language === info.language,
    );
    if (!alreadyHasEntry) {
      group.entries.push({
        type: info.type,
        language: info.language,
        detail: h.episode || "\u2014",
      });
    }
  }

  return Array.from(titleMap.entries()).map(([titleSlug, data]) => ({
    titleSlug,
    displayName: data.displayName,
    entries: data.entries,
  }));
}

function updateTitleList() {
  const container = document.getElementById("progress-list")!;
  container.textContent = "";

  const titles = buildTitlePreviews();

  if (titles.length === 0) {
    const p = document.createElement("p");
    p.className = "empty";
    const typeFilter = getActiveTypeFilter();
    if (typeFilter === "all") {
      p.textContent = "No data found";
    } else {
      const label = typeFilter === "scan" ? "manga" : typeFilter;
      p.textContent = `No ${label} data found`;
    }
    container.appendChild(p);
    return;
  }

  for (const title of titles) {
    const group = document.createElement("div");
    group.className = "title-group";

    const header = document.createElement("label");
    header.className = "title-header";

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.className = "title-checkbox";
    checkbox.checked = !excludedTitles.has(title.titleSlug);
    checkbox.addEventListener("change", () => {
      if (checkbox.checked) {
        excludedTitles.delete(title.titleSlug);
      } else {
        excludedTitles.add(title.titleSlug);
      }
    });
    header.appendChild(checkbox);

    const titleText = document.createElement("span");
    titleText.textContent = title.displayName;
    header.appendChild(titleText);

    group.appendChild(header);

    for (const entry of title.entries) {
      const row = document.createElement("div");
      row.className = "title-entry";

      if (entry.type) {
        const badge = document.createElement("span");
        badge.className = `badge badge-${sanitizeClassName(entry.type)}`;
        badge.textContent = entry.type;
        row.appendChild(badge);
      }
      if (entry.language) {
        const badge = document.createElement("span");
        badge.className = `badge badge-${sanitizeClassName(entry.language)}`;
        badge.textContent = entry.language.toUpperCase();
        row.appendChild(badge);
      }

      const progressSpan = document.createElement("span");
      progressSpan.className = "entry-progress";
      progressSpan.textContent = entry.detail;
      row.appendChild(progressSpan);

      group.appendChild(row);
    }

    container.appendChild(group);
  }
}

function showEmptyState() {
  const container = document.getElementById("progress-list")!;
  container.textContent = "";
  const div = document.createElement("div");
  div.className = "empty-state";
  const p = document.createElement("p");
  p.textContent = "No localStorage data found on this page.";
  div.appendChild(p);
  container.appendChild(div);
}

function showErrorState(error: string) {
  const container = document.getElementById("progress-list")!;
  container.textContent = "";
  const div = document.createElement("div");
  div.className = "empty-state";
  const p = document.createElement("p");
  p.textContent = error;
  div.appendChild(p);
  container.appendChild(div);
}

function handleExport() {
  if (!currentData) return;
  const btn = document.getElementById("btn-export") as HTMLButtonElement;
  btn.disabled = true;
  btn.textContent = "Exporting...";
  try {
    const typeFilter = getActiveTypeFilter();
    const filteredData = filterRaw(currentData.raw, excludedTitles, typeFilter);
    const blob = exportToJson(filteredData);
    const date = new Date().toISOString().slice(0, 10);
    downloadBlob(blob, `as-sync-${currentDomain}-${date}.json`);
    showMessage("Export successful", "success");
  } catch {
    showMessage("Export failed. Please try again.", "error");
  }
  btn.disabled = false;
  btn.textContent = "Export";
}

async function handleImport() {
  const [tab] = await browser.tabs.query({
    active: true,
    currentWindow: true,
  });
  if (!tab?.id) return;
  const host = tab.url ? new URL(tab.url).hostname : "";
  browser.tabs.create({
    url: browser.runtime.getURL(
      `/import.html?tabId=${tab.id}&target=${encodeURIComponent(host)}`,
    ),
  });
  window.close();
}

let messageTimer: ReturnType<typeof setTimeout> | undefined;

function showMessage(text: string, type: "success" | "error" | "info") {
  const el = document.getElementById("message")!;
  clearTimeout(messageTimer);
  el.textContent = text;
  el.className = `message message-${type}`;
  el.style.display = "";
  if (type !== "info") {
    messageTimer = setTimeout(() => {
      el.style.display = "none";
    }, 3000);
  }
}

function sanitizeClassName(str: string): string {
  return str.replace(/[^a-zA-Z0-9-]/g, "");
}

function capitalize(str: string): string {
  return str.replace(/\b\w/g, (c) => c.toUpperCase());
}

init();
