export type QualityHint = "standard" | "high" | "unknown";

export type Track = {
  id: string;
  title: string;
  artist: string;
  durationMs: number;
  artworkUrl: string | null;
  permalinkUrl: string;
  embedUrl: string | null;
  qualityHint: QualityHint;
  waveformUrl: string | null;
  playbackLabel: string;
  source: "search" | "url";
};

export type SearchResponse = {
  tracks: Track[];
};

export type TrackDetails = {
  [key: string]: unknown;
  id?: number;
  title?: string;
  description?: string | null;
  genre?: string | null;
  tag_list?: string;
  duration?: number;
  artwork_url?: string | null;
  permalink_url?: string;
  likes_count?: number;
  playback_count?: number;
  reposts_count?: number;
  comment_count?: number;
  download_count?: number;
  downloadable?: boolean;
  streamable?: boolean;
  release_date?: string | null;
  created_at?: string;
  display_date?: string;
  license?: string;
  user?: {
    [key: string]: unknown;
    username?: string;
    full_name?: string | null;
    permalink_url?: string;
    avatar_url?: string | null;
  };
};

export type TrackDetailsResponse = {
  track: Track;
  details: TrackDetails;
};
