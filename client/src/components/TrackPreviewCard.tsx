import type { CSSProperties } from "react";
import type { Track, TrackDetails } from "../types";

type PreviewState = "idle" | "loading" | "done" | "error";
type DownloadFormat = "mp3" | "flac" | "wav";
type DownloadQuality = "0" | "2" | "5" | "7" | "9" | "128k" | "192k" | "256k" | "320k";

type TrackPreviewCardProps = {
  state: PreviewState;
  message: string;
  sourceLabel: string;
  track: Track | null;
  details: TrackDetails | null;
  format: DownloadFormat;
  quality: DownloadQuality;
  favorite: boolean;
  recentCount: number;
  downloading: boolean;
  onDownload: () => void;
  onCopyMetadata: () => void;
  onToggleFavorite: () => void;
};

const FALLBACK_ARTWORK = "https://placehold.co/600x600/101620/f97316?text=SNDCLD";

function compactNumber(value: unknown) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "Unknown";
  }

  return Intl.NumberFormat(undefined, {
    maximumFractionDigits: value >= 1000 ? 1 : 0,
    notation: value >= 10000 ? "compact" : "standard"
  }).format(value);
}

function formatDate(value: unknown) {
  if (typeof value !== "string" || !value.trim()) {
    return "Unknown";
  }

  const normalized =
    /^\d{8}$/.test(value) ? `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6)}` : value;
  const parsed = new Date(normalized);

  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric"
  });
}

function getString(value: unknown, fallback = "Unknown") {
  return typeof value === "string" && value.trim() ? value : fallback;
}

function getNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function getUploadDate(details: TrackDetails | null) {
  return formatDate(details?.release_date ?? details?.display_date ?? details?.created_at ?? details?.upload_date);
}

function getPlays(details: TrackDetails | null) {
  return compactNumber(details?.playback_count ?? details?.view_count);
}

function getLikes(details: TrackDetails | null) {
  return compactNumber(details?.likes_count ?? details?.like_count);
}

function getGenre(details: TrackDetails | null) {
  const category = Array.isArray(details?.categories) ? details?.categories[0] : null;
  return getString(details?.genre ?? category, "Audio");
}

function getBpm(details: TrackDetails | null) {
  const tagList = getString(details?.tag_list, "");
  const tagMatch = tagList.match(/\b(\d{2,3})\s?bpm\b/i);
  const tagValue = Array.isArray(details?.tags)
    ? details?.tags.find((tag) => /\b\d{2,3}\s?bpm\b/i.test(tag))
    : null;
  const arrayMatch = tagValue?.match(/\b(\d{2,3})\s?bpm\b/i);

  return tagMatch?.[1] ?? arrayMatch?.[1] ?? "BPM unknown";
}

function getCodec(details: TrackDetails | null) {
  return getString(details?.acodec ?? details?.ext, "Source audio");
}

function isTrueLossless(details: TrackDetails | null) {
  const codec = getString(details?.acodec ?? details?.ext, "").toLowerCase();
  return /\b(flac|alac|wav|pcm|aiff)\b/.test(codec);
}

function isCompressedSource(track: Track | null, details: TrackDetails | null) {
  return !isTrueLossless(details) && track?.qualityHint !== "unknown";
}

function getRecommendation(format: DownloadFormat, compressed: boolean, lossless: boolean) {
  if (lossless) {
    return "FLAC";
  }

  if (compressed) {
    return "MP3 320";
  }

  return format.toUpperCase();
}

function getBitrate(format: DownloadFormat, quality: DownloadQuality, details: TrackDetails | null) {
  if (format === "mp3") {
    return Number.parseInt(quality, 10);
  }

  if (format === "wav") {
    return 1411;
  }

  return isTrueLossless(details) ? 850 : Math.max(getNumber(details?.abr) ?? 256, 256);
}

function estimateFileSize(track: Track | null, format: DownloadFormat, quality: DownloadQuality, details: TrackDetails | null) {
  if (!track?.durationMs) {
    return "Unknown";
  }

  const seconds = Math.max(1, Math.round(track.durationMs / 1000));
  const bitrateKbps = getBitrate(format, quality, details);
  const megabytes = (seconds * bitrateKbps) / 8 / 1024;

  return `${megabytes.toFixed(megabytes >= 100 ? 0 : 1)} MB`;
}

function getSourceQuality(track: Track | null, details: TrackDetails | null) {
  if (isTrueLossless(details)) {
    return "True lossless source";
  }

  const abr = getNumber(details?.abr);
  if (abr) {
    return `${Math.round(abr)} kbps source`;
  }

  return track?.qualityHint === "high" ? "High quality stream" : "Compressed stream";
}

function DetailStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="preview-stat">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function PreviewSkeleton() {
  return (
    <div className="track-preview-skeleton">
      <div className="skeleton-art" />
      <div className="skeleton-copy">
        <span />
        <strong />
        <p />
        <div className="skeleton-wave" aria-hidden="true">
          {Array.from({ length: 28 }).map((_, index) => (
            <i key={index} style={{ "--bar": `${(index % 7) + 2}` } as CSSProperties} />
          ))}
        </div>
      </div>
    </div>
  );
}

export function TrackPreviewCard({
  state,
  message,
  sourceLabel,
  track,
  details,
  format,
  quality,
  favorite,
  recentCount,
  downloading,
  onDownload,
  onCopyMetadata,
  onToggleFavorite
}: TrackPreviewCardProps) {
  const compressed = isCompressedSource(track, details);
  const lossless = isTrueLossless(details);
  const recommendation = getRecommendation(format, compressed, lossless);
  const estimatedSize = estimateFileSize(track, format, quality, details);
  const officialUploader = Boolean(details?.user?.permalink_url || details?.channel_is_verified);
  const explicit = getNumber(details?.age_limit) !== null && (getNumber(details?.age_limit) ?? 0) >= 18;
  const plays = getNumber(details?.playback_count ?? details?.view_count) ?? 0;
  const likes = getNumber(details?.likes_count ?? details?.like_count) ?? 0;
  const trending = plays > 100000 || likes > 5000;

  if (state === "idle") {
    return null;
  }

  return (
    <section className={`track-preview-card ${state}`} aria-live="polite">
      <div className="preview-orbit" />
      <div className="track-preview-head">
        <div>
          <p className="section-kicker">Track preview</p>
          <h2>Verify before download</h2>
        </div>
        <span className={`preview-state ${state}`}>{state === "done" ? "ready" : state}</span>
      </div>

      {state === "loading" ? (
        <>
          <div className="inline-message loading">
            <span className="status-light" />
            <p>{message}</p>
          </div>
          <PreviewSkeleton />
        </>
      ) : null}

      {state === "error" ? (
        <div className="preview-error">
          <span className="status-light" />
          <div>
            <strong>Preview unavailable</strong>
            <p>{message}</p>
          </div>
        </div>
      ) : null}

      {state === "done" && track ? (
        <div className="track-preview-layout">
          <div className="preview-art-wrap">
            <img
              alt={`${track.title} artwork`}
              className="preview-art"
              src={track.artworkUrl ?? FALLBACK_ARTWORK}
            />
          </div>

          <div className="preview-content">
            <div className="preview-title-row">
              <div>
                <span className="preview-platform">{sourceLabel}</span>
                <h3>Title: {track.title}</h3>
                <p>Artist: {track.artist}</p>
              </div>
              {officialUploader ? <span className="verified-badge">Verified</span> : null}
            </div>

            <div className="preview-stats-grid">
              <DetailStat label="Duration" value={track.playbackLabel} />
              <DetailStat label="Est. size" value={estimatedSize} />
              <DetailStat label="Uploaded" value={getUploadDate(details)} />
              <DetailStat label="Plays" value={getPlays(details)} />
              <DetailStat label="Likes" value={getLikes(details)} />
              <DetailStat label="Bitrate" value={`${getBitrate(format, quality, details)} kbps`} />
            </div>

            <div className="quality-panel">
              <div>
                <span>Original source</span>
                <strong>{getSourceQuality(track, details)}</strong>
              </div>
              <div>
                <span>Best codec</span>
                <strong>{getCodec(details)}</strong>
              </div>
              <div>
                <span>Recommended</span>
                <strong>{recommendation}</strong>
              </div>
            </div>

            {format === "wav" && compressed ? (
              <div className="preview-warning">
                WAV will not improve original quality.
              </div>
            ) : null}

            <div className="preview-tags">
              <span>{getGenre(details)}</span>
              <span>{getBpm(details)}</span>
              {explicit ? <span>Explicit</span> : null}
              {trending ? <span>Trending</span> : null}
              {lossless ? <span className="tag-success">True lossless</span> : <span>HQ stream</span>}
            </div>

            <div className="preview-actions">
              <button
                className="download-now-button"
                disabled={downloading}
                onClick={onDownload}
                type="button"
              >
                {downloading ? "Downloading" : "Download Now"}
              </button>
              <button className="secondary-preview-button" onClick={onCopyMetadata} type="button">
                Copy Metadata
              </button>
              <button
                aria-label={favorite ? "Remove saved track" : "Save track"}
                className={`save-preview-button ${favorite ? "is-active" : ""}`}
                onClick={onToggleFavorite}
                title={favorite ? "Remove saved track" : "Save track"}
                type="button"
              >
                {favorite ? "Saved" : "Save"}
              </button>
            </div>

            <div className="recent-download-strip">
              <span>{recentCount} recent downloads</span>
              <span>{format.toUpperCase()} updates live</span>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
