import { PROGRESS_PREFIXES, extractTitleInfo } from "./storage-parser";

const HISTORY_KEYS = [
  "histoUrl",
  "histoType",
  "histoNom",
  "histoImg",
  "histoLang",
  "histoEp",
] as const;

function parseJsonArray(value: string): string[] {
  try {
    let parsed: unknown = JSON.parse(value);
    if (typeof parsed === "string") parsed = JSON.parse(parsed);
    if (Array.isArray(parsed)) return parsed as string[];
  } catch {
    /* not an array */
  }
  return [];
}

function matchesTypeFilter(
  type: string,
  typeFilter: "anime" | "scan" | "film",
): boolean {
  if (typeFilter === "scan") return type === "scan";
  if (typeFilter === "film") return type === "film";
  return type !== "scan" && type !== "film";
}

export function filterRaw(
  raw: Record<string, string>,
  excludedTitles: Set<string>,
  typeFilter: "all" | "anime" | "scan" | "film",
): Record<string, string> {
  if (excludedTitles.size === 0 && typeFilter === "all") return raw;

  const filtered: Record<string, string> = {};

  for (const [key, value] of Object.entries(raw)) {
    let isProgressKey = false;

    for (const prefix of PROGRESS_PREFIXES) {
      if (key.startsWith(prefix)) {
        isProgressKey = true;
        const pathname = key.slice(prefix.length);
        const info = extractTitleInfo(pathname);
        if (!info) {
          if (typeFilter !== "all") break;
          filtered[key] = value;
          break;
        }
        if (excludedTitles.has(info.titleSlug)) break;
        if (typeFilter !== "all" && !matchesTypeFilter(info.type, typeFilter))
          break;
        filtered[key] = value;
        break;
      }
    }

    if (!isProgressKey) {
      filtered[key] = value;
    }
  }

  if (typeFilter !== "all") {
    filterHistoryArrays(filtered, typeFilter);
  }

  return filtered;
}

function filterHistoryArrays(
  raw: Record<string, string>,
  typeFilter: "anime" | "scan" | "film",
): void {
  const urlArray = raw[HISTORY_KEYS[0]];
  if (!urlArray) return;

  const urls = parseJsonArray(urlArray);
  if (urls.length === 0) return;

  const keepIndices: number[] = [];
  for (let i = 0; i < urls.length; i++) {
    const info = extractTitleInfo(urls[i]);
    if (!info) {
      keepIndices.push(i);
      continue;
    }
    if (matchesTypeFilter(info.type, typeFilter)) {
      keepIndices.push(i);
    }
  }

  if (keepIndices.length === urls.length) return;

  const allArrays = HISTORY_KEYS.map((k) => parseJsonArray(raw[k] || ""));
  const minLen = Math.min(
    ...allArrays.map((a) => a.length).filter((l) => l > 0),
  );
  const safeIndices = keepIndices.filter((i) => i < minLen);

  for (let k = 0; k < HISTORY_KEYS.length; k++) {
    const arr = allArrays[k];
    if (arr.length === 0) continue;
    raw[HISTORY_KEYS[k]] = JSON.stringify(safeIndices.map((i) => arr[i]));
  }
}
