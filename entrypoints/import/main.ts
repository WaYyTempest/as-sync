import "./styles.css";
import {
  parseLocalStorage,
  extractTitleInfo,
} from "../../utils/storage-parser";
import { filterRaw } from "../../utils/raw-filter";
import type { AnimeSamaData } from "../../utils/types";

type TypeFilter = "all" | "anime" | "scan" | "film";

const params = new URLSearchParams(window.location.search);
const targetTabId = parseInt(params.get("tabId") || "", 10);

let pendingData: Record<string, string> | null = null;
let parsedData: AnimeSamaData | null = null;
let excludedTitles = new Set<string>();

function getActiveTypeFilter(): TypeFilter {
  const active = document.querySelector(
    "#type-filter .filter-btn.active",
  ) as HTMLElement | null;
  return (active?.dataset.type as TypeFilter) || "all";
}

if (!targetTabId || isNaN(targetTabId)) {
  document.getElementById("error-state")!.style.display = "";
} else {
  init();
}

async function init() {
  let tabUrl = params.get("target") || "unknown";
  if (tabUrl === "unknown") {
    try {
      const tab = await browser.tabs.get(targetTabId);
      if (tab?.url) tabUrl = new URL(tab.url).hostname;
    } catch {
      /* tab may have closed */
    }
  }

  document.getElementById("target-domain")!.textContent = tabUrl;
  document.getElementById("import-ui")!.style.display = "";
  setupEvents();
}

function setupEvents() {
  const fileInput = document.getElementById("file-input") as HTMLInputElement;
  const dropZone = document.getElementById("drop-zone")!;

  document.addEventListener("dragover", (e) => e.preventDefault());
  document.addEventListener("drop", (e) => e.preventDefault());

  dropZone.addEventListener("click", () => fileInput.click());

  dropZone.addEventListener("dragover", (e) => {
    e.preventDefault();
    e.stopPropagation();
    dropZone.classList.add("drag-over");
  });

  dropZone.addEventListener("dragleave", () => {
    dropZone.classList.remove("drag-over");
  });

  dropZone.addEventListener("drop", (e) => {
    e.preventDefault();
    e.stopPropagation();
    dropZone.classList.remove("drag-over");
    const file = e.dataTransfer?.files[0];
    if (file) handleFile(file);
  });

  fileInput.addEventListener("change", () => {
    const file = fileInput.files?.[0];
    if (file) handleFile(file);
    fileInput.value = "";
  });

  document
    .getElementById("btn-confirm")!
    .addEventListener("click", confirmImport);
  document.getElementById("btn-cancel")!.addEventListener("click", () => {
    pendingData = null;
    parsedData = null;
    excludedTitles = new Set<string>();
    document.getElementById("preview")!.style.display = "none";
    document.getElementById("drop-zone")!.style.display = "";
    resetTypeFilterUI();
    hideMsg();
  });

  setupTypeFilter();
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
    updateImportProgressList();
    updatePreviewKeys();
  });
}

function resetTypeFilterUI() {
  const filterBar = document.getElementById("type-filter")!;
  filterBar
    .querySelectorAll(".filter-btn")
    .forEach((b) => b.classList.remove("active"));
  filterBar.querySelector('[data-type="all"]')?.classList.add("active");
}

async function handleFile(file: File) {
  showMsg("Reading file...", "info");
  try {
    const text = await file.text();
    const parsed: unknown = JSON.parse(text);

    if (
      typeof parsed !== "object" ||
      parsed === null ||
      Array.isArray(parsed)
    ) {
      showMsg(
        "Invalid format: expected a JSON object with key-value pairs",
        "error",
      );
      return;
    }

    const raw: Record<string, string> = {};
    for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
      raw[k] = typeof v === "string" ? v : JSON.stringify(v);
    }

    if (Object.keys(raw).length === 0) {
      showMsg("No data found in file", "error");
      return;
    }

    pendingData = raw;
    parsedData = parseLocalStorage(raw, "import");
    excludedTitles = new Set<string>();
    resetTypeFilterUI();

    const meta = document.getElementById("preview-meta")!;
    meta.textContent = "";
    const strong = document.createElement("strong");
    strong.textContent = "Keys to import: ";
    meta.appendChild(strong);
    meta.appendChild(document.createTextNode(String(Object.keys(raw).length)));

    updateImportProgressList();
    updatePreviewKeys();
    document.getElementById("drop-zone")!.style.display = "none";
    document.getElementById("preview")!.style.display = "";
    hideMsg();
  } catch (err) {
    showMsg(
      `Failed to parse JSON: ${err instanceof Error ? err.message : err}`,
      "error",
    );
  }
}

function matchesType(type: string, filter: TypeFilter): boolean {
  if (filter === "all") return true;
  if (filter === "scan") return type === "scan";
  if (filter === "film") return type === "film";
  return type !== "scan" && type !== "film";
}

function updateImportProgressList() {
  const container = document.getElementById("import-progress-list")!;
  container.textContent = "";

  if (!parsedData) return;

  const typeFilter = getActiveTypeFilter();
  const titleMap = new Map<
    string,
    {
      displayName: string;
      entries: Array<{ type: string; language: string; detail: string }>;
    }
  >();

  for (const p of parsedData.progress) {
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

  for (const h of parsedData.history) {
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
      h.name &&
      group.displayName === capitalize(info.titleSlug.replace(/-/g, " "))
    ) {
      group.displayName = h.name;
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

  if (titleMap.size === 0) {
    if (typeFilter !== "all") {
      const p = document.createElement("p");
      p.className = "empty-filter";
      const label = typeFilter === "scan" ? "manga" : typeFilter;
      p.textContent = `No ${label} data found`;
      container.appendChild(p);
    }
    return;
  }

  for (const [titleSlug, data] of titleMap) {
    const group = document.createElement("div");
    group.className = "title-group";

    const header = document.createElement("label");
    header.className = "title-header";

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.className = "title-checkbox";
    checkbox.checked = !excludedTitles.has(titleSlug);
    checkbox.addEventListener("change", () => {
      if (checkbox.checked) {
        excludedTitles.delete(titleSlug);
      } else {
        excludedTitles.add(titleSlug);
      }
      updatePreviewKeys();
    });
    header.appendChild(checkbox);

    const titleText = document.createElement("span");
    titleText.textContent = data.displayName;
    header.appendChild(titleText);

    group.appendChild(header);

    for (const entry of data.entries) {
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

function updatePreviewKeys() {
  if (!pendingData) return;
  const typeFilter = getActiveTypeFilter();
  const filtered = filterRaw(pendingData, excludedTitles, typeFilter);
  const keysEl = document.getElementById("preview-keys")!;
  keysEl.textContent = Object.keys(filtered).join("\n");

  const meta = document.getElementById("preview-meta")!;
  meta.textContent = "";
  const strong = document.createElement("strong");
  strong.textContent = "Keys to import: ";
  meta.appendChild(strong);
  meta.appendChild(
    document.createTextNode(String(Object.keys(filtered).length)),
  );
}

async function confirmImport() {
  if (!pendingData) return;
  const typeFilter = getActiveTypeFilter();
  const data = filterRaw(pendingData, excludedTitles, typeFilter);
  pendingData = null;
  parsedData = null;

  const btn = document.getElementById("btn-confirm") as HTMLButtonElement;
  btn.disabled = true;
  btn.textContent = "Importing...";
  showMsg(
    `Injecting ${Object.keys(data).length} keys into localStorage...`,
    "info",
  );

  try {
    const response = await browser.tabs.sendMessage(targetTabId, {
      type: "SET_ALL_STORAGE",
      data,
    });

    if (response?.success) {
      const written = response.written || Object.keys(data).length;
      showMsg(
        `Import successful! ${written} keys injected. You can close this tab.`,
        "success",
      );
      document.getElementById("preview")!.style.display = "none";
    } else {
      showMsg(`Import failed: ${response?.error || "Unknown error"}`, "error");
      btn.disabled = false;
      btn.textContent = "Import into localStorage";
    }
  } catch (err) {
    showMsg(
      `Import failed: ${err instanceof Error ? err.message : err}. Make sure the target tab is still open.`,
      "error",
    );
    btn.disabled = false;
    btn.textContent = "Import into localStorage";
  }
}

function showMsg(text: string, type: "success" | "error" | "info") {
  const el = document.getElementById("message")!;
  el.textContent = text;
  el.className = `message message-${type}`;
  el.style.display = "";
}

function hideMsg() {
  const el = document.getElementById("message");
  if (el) el.style.display = "none";
}

function sanitizeClassName(str: string): string {
  return str.replace(/[^a-zA-Z0-9-]/g, "");
}

function capitalize(str: string): string {
  return str.replace(/\b\w/g, (c) => c.toUpperCase());
}
