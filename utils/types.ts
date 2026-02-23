export interface AnimeProgress {
  titleSlug: string;
  type: string;
  language: string;
  episodeName?: string;
  episodeNumber?: number;
  chapterName?: string;
  chapterNumber?: number;
  pathname: string;
}

export interface HistoryEntry {
  url: string;
  type: string;
  name: string;
  image: string;
  language: string;
  episode: string;
}

export interface WatchlistEntry {
  url: string;
  name: string;
  image: string;
}

export interface FavoriteEntry {
  url: string;
  name: string;
  image: string;
}

export interface AnimeSamaData {
  progress: AnimeProgress[];
  history: HistoryEntry[];
  watchlist: WatchlistEntry[];
  favorites: FavoriteEntry[];
  raw: Record<string, string>;
  metadata: {
    exportDate: string;
    sourceDomain: string;
    version: string;
  };
}
