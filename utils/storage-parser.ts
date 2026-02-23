import type { AnimeSamaData, AnimeProgress, HistoryEntry, WatchlistEntry, FavoriteEntry } from './types';

const PROGRESS_PREFIXES = ['savedEpName', 'savedEpNb', 'savedChapName', 'savedChapNb'] as const;
const HISTORY_KEYS = ['histoUrl', 'histoType', 'histoNom', 'histoImg', 'histoLang', 'histoEp'] as const;
const WATCHLIST_KEYS = ['watchlistUrl', 'watchlistNom', 'watchlistImg'] as const;
const FAVORITE_KEYS = ['favoriUrl', 'favoriNom', 'favoriImg'] as const;

const MAX_PARSE_DEPTH = 5;

function extractTitleInfo(pathname: string): { titleSlug: string; type: string; language: string } | null {
  const parts = pathname.replace(/^\//, '').replace(/\/$/, '').split('/');
  if (parts.length >= 4 && parts[0] === 'catalogue') {
    return { titleSlug: parts[1], type: parts[2], language: parts[3] };
  }
  return null;
}

function parseJsonSafe(value: string, depth = 0): string | string[] | number {
  if (depth >= MAX_PARSE_DEPTH) return value;
  try {
    const parsed: unknown = JSON.parse(value);
    if (typeof parsed === 'string') return parseJsonSafe(parsed, depth + 1);
    if (typeof parsed === 'number') return parsed;
    if (Array.isArray(parsed)) return parsed as string[];
    return value;
  } catch {
    return value;
  }
}

function parseProgressEntries(raw: Record<string, string>): AnimeProgress[] {
  const progressMap = new Map<string, Partial<AnimeProgress>>();

  for (const [key, value] of Object.entries(raw)) {
    for (const prefix of PROGRESS_PREFIXES) {
      if (key.startsWith(prefix)) {
        const pathname = key.slice(prefix.length);
        if (!progressMap.has(pathname)) {
          progressMap.set(pathname, { pathname });
        }
        const entry = progressMap.get(pathname)!;
        const titleInfo = extractTitleInfo(pathname);
        if (titleInfo) {
          entry.titleSlug = titleInfo.titleSlug;
          entry.type = titleInfo.type;
          entry.language = titleInfo.language;
        }

        const parsed = parseJsonSafe(value);
        switch (prefix) {
          case 'savedEpName':
            entry.episodeName = typeof parsed === 'string' ? parsed : String(parsed);
            break;
          case 'savedEpNb':
            entry.episodeNumber = Number(parsed);
            break;
          case 'savedChapName':
            entry.chapterName = typeof parsed === 'string' ? parsed : String(parsed);
            break;
          case 'savedChapNb':
            entry.chapterNumber = Number(parsed);
            break;
        }
      }
    }
  }

  return Array.from(progressMap.values()).filter(
    (e): e is AnimeProgress => typeof e.titleSlug === 'string' && e.titleSlug.length > 0
  );
}

function parseParallelArrays<T>(raw: Record<string, string>, keys: readonly string[], fields: readonly string[]): T[] {
  const arrays: string[][] = keys.map(k => {
    const val = raw[k];
    if (!val) return [];
    const parsed = parseJsonSafe(val);
    return Array.isArray(parsed) ? parsed : [];
  });

  if (arrays.every(a => a.length === 0)) return [];
  const nonEmpty = arrays.filter(a => a.length > 0);
  if (nonEmpty.length === 0) return [];
  const length = Math.min(...nonEmpty.map(a => a.length));
  const result: T[] = [];

  for (let i = 0; i < length; i++) {
    const entry: Record<string, string> = {};
    fields.forEach((field, idx) => {
      entry[field] = arrays[idx]?.[i] ?? '';
    });
    if (entry[fields[0]]) {
      result.push(entry as T);
    }
  }

  return result;
}

export function parseLocalStorage(raw: Record<string, string>, sourceDomain: string): AnimeSamaData {
  return {
    progress: parseProgressEntries(raw),
    history: parseParallelArrays<HistoryEntry>(raw, HISTORY_KEYS, ['url', 'type', 'name', 'image', 'language', 'episode']),
    watchlist: parseParallelArrays<WatchlistEntry>(raw, WATCHLIST_KEYS, ['url', 'name', 'image']),
    favorites: parseParallelArrays<FavoriteEntry>(raw, FAVORITE_KEYS, ['url', 'name', 'image']),
    raw,
    metadata: {
      exportDate: new Date().toISOString(),
      sourceDomain,
      version: '1.0.0',
    },
  };
}
