export type QualityHint = "standard" | "high" | "unknown";

export type NormalizedTrack = {
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

export type SoundCloudTrack = {
  [key: string]: unknown;
  id: number;
  urn?: string;
  title: string;
  description?: string | null;
  genre?: string | null;
  tag_list?: string;
  permalink?: string;
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
  embeddable_by?: string;
  purchase_url?: string | null;
  purchase_title?: string | null;
  label_name?: string | null;
  release_date?: string | null;
  created_at?: string;
  display_date?: string;
  license?: string;
  user?: {
    [key: string]: unknown;
    username?: string;
    full_name?: string | null;
    permalink?: string;
    permalink_url?: string;
    avatar_url?: string | null;
  };
  waveform_url?: string | null;
  media?: {
    transcodings?: Array<{
      preset?: string;
      format?: {
        protocol?: string;
        mime_type?: string;
      };
    }>;
  };
};
