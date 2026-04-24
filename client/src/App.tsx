import { useEffect, useMemo, useRef, useState } from "react";
import { captureEvent } from "./analytics";
import { SourceTabs } from "./components/SourceTabs";
import { TrackPreviewCard } from "./components/TrackPreviewCard";
import type { SearchResponse, Track, TrackDetails, TrackDetailsResponse } from "./types";

const LOSSLESS_FORMATS = new Set(["flac", "wav"]);
const MP3_BITRATES = ["128k", "192k", "256k", "320k"] as const;
const FORMAT_OPTIONS = ["mp3", "flac", "wav"] as const;
const SOURCE_OPTIONS = [
  {
    value: "soundcloud",
    label: "SoundCloud",
    placeholder: "URL of a SoundCloud track, playlist, or artist page",
    emptyMessage: "Paste a SoundCloud URL first.",
    invalidMessage: "That does not look like a SoundCloud link."
  },
  {
    value: "youtube",
    label: "YouTube",
    placeholder: "URL of a YouTube track, playlist, or channel page",
    emptyMessage: "Paste a YouTube URL first.",
    invalidMessage: "That does not look like a YouTube link."
  }
] as const;

type DownloadFormat = (typeof FORMAT_OPTIONS)[number];
type DownloadQuality = "0" | "2" | "5" | "7" | "9" | "128k" | "192k" | "256k" | "320k";
type DownloadSource = (typeof SOURCE_OPTIONS)[number]["value"];
type DownloadTrigger = "main_button" | "preview_button" | "enter_key";
type StatusType = "idle" | "downloading" | "done" | "error";
type LoadState = "idle" | "loading" | "done" | "error";

const RECENT_SEARCHES_KEY = "sndcld:recent-searches";
const FAVORITES_KEY = "sndcld:favorites";

const qualityOptions: Array<{ value: "0" | "2" | "5" | "7" | "9"; label: string }> = [
  { value: "0", label: "Best, around 245 kbps" },
  { value: "2", label: "High, around 190 kbps" },
  { value: "5", label: "Medium, around 130 kbps" },
  { value: "7", label: "Low, around 100 kbps" },
  { value: "9", label: "Worst, around 65 kbps" }
];

const mp3BitrateOptions: Array<{ value: (typeof MP3_BITRATES)[number]; label: string }> = [
  { value: "320k", label: "320 kbps (best)" },
  { value: "256k", label: "256 kbps" },
  { value: "192k", label: "192 kbps" },
  { value: "128k", label: "128 kbps" }
];

function readFilename(disposition: string | null, fallbackFormat: string) {
  if (!disposition) {
    return `track.${fallbackFormat}`;
  }

  const utf8Match = disposition.match(/filename\*=UTF-8''([^;]+)/i);
  if (utf8Match?.[1]) {
    return decodeURIComponent(utf8Match[1]);
  }

  const basicMatch = disposition.match(/filename="?([^"]+)"?/i);
  return basicMatch?.[1] ?? `track.${fallbackFormat}`;
}

function isSourceUrl(value: string, source: DownloadSource) {
  try {
    const parsed = new URL(value);
    const hostname = parsed.hostname.toLowerCase().replace(/^www\./, "");

    if (source === "soundcloud") {
      return (
        hostname === "soundcloud.com" ||
        hostname.endsWith(".soundcloud.com") ||
        hostname === "on.soundcloud.com" ||
        hostname === "snd.sc"
      );
    }

    return (
      hostname === "youtube.com" ||
      hostname.endsWith(".youtube.com") ||
      hostname === "youtu.be"
    );
  } catch {
    return false;
  }
}

function readStoredTracks(key: string) {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as Track[]) : [];
  } catch {
    return [];
  }
}

function readStoredStrings(key: string) {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((item) => typeof item === "string") : [];
  } catch {
    return [];
  }
}

function uniqueTracks(tracks: Track[]) {
  const seen = new Set<string>();

  return tracks.filter((track) => {
    const key = `${track.id}-${track.source}`;
    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

function getDetailValue(details: TrackDetails | null, key: keyof TrackDetails) {
  const value = details?.[key];
  if (typeof value === "number") {
    return value.toLocaleString();
  }

  if (typeof value === "boolean") {
    return value ? "Yes" : "No";
  }

  return typeof value === "string" && value.trim() ? value : "Unknown";
}

function buildPreviewMetadataText(track: Track, details: TrackDetails | null, format: string) {
  const lines = [
    `Title: ${track.title}`,
    `Artist: ${track.artist}`,
    `Duration: ${track.playbackLabel}`,
    `Format: ${format.toUpperCase()}`,
    `Source: ${track.permalinkUrl || "Unknown"}`
  ];

  const genre = details?.genre;
  const plays = details?.playback_count ?? details?.view_count;
  const likes = details?.likes_count ?? details?.like_count;

  if (typeof genre === "string" && genre.trim()) {
    lines.push(`Genre: ${genre}`);
  }

  if (typeof plays === "number") {
    lines.push(`Plays: ${plays.toLocaleString()}`);
  }

  if (typeof likes === "number") {
    lines.push(`Likes: ${likes.toLocaleString()}`);
  }

  return lines.join("\n");
}

export default function App() {
  const trackedUrlInputRef = useRef(false);
  const [source, setSource] = useState<DownloadSource>("soundcloud");
  const [url, setUrl] = useState("");
  const [format, setFormat] = useState<DownloadFormat>("mp3");
  const [quality, setQuality] = useState<DownloadQuality>("320k");
  const [statusType, setStatusType] = useState<StatusType>("idle");
  const [statusMessage, setStatusMessage] = useState(
    "Choose a source, paste a track URL, choose a format, and download it."
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [searchState, setSearchState] = useState<LoadState>("idle");
  const [searchMessage, setSearchMessage] = useState("Search needs a SoundCloud client ID.");
  const [searchResults, setSearchResults] = useState<Track[]>([]);
  const [analyzeUrl, setAnalyzeUrl] = useState("");
  const [analyzeState, setAnalyzeState] = useState<LoadState>("idle");
  const [analyzeMessage, setAnalyzeMessage] = useState("Paste a SoundCloud link to inspect metadata.");
  const [activeTrack, setActiveTrack] = useState<Track | null>(null);
  const [activeDetails, setActiveDetails] = useState<TrackDetails | null>(null);
  const [previewState, setPreviewState] = useState<LoadState>("idle");
  const [previewMessage, setPreviewMessage] = useState("Paste a valid track URL to preview metadata.");
  const [previewTrack, setPreviewTrack] = useState<Track | null>(null);
  const [previewDetails, setPreviewDetails] = useState<TrackDetails | null>(null);
  const [workspaceTracks, setWorkspaceTracks] = useState<Track[]>([]);
  const [favoriteTracks, setFavoriteTracks] = useState<Track[]>([]);
  const [recentDownloads, setRecentDownloads] = useState<Track[]>([]);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);

  const isLossless = LOSSLESS_FORMATS.has(format);
  const isMp3 = format === "mp3";
  const isBusy = statusType === "downloading";
  const trimmedUrl = url.trim();
  const selectedSource =
    SOURCE_OPTIONS.find((option) => option.value === source) ?? SOURCE_OPTIONS[0];
  const favoriteIds = useMemo(
    () => new Set(favoriteTracks.map((track) => `${track.id}-${track.source}`)),
    [favoriteTracks]
  );

  useEffect(() => {
    setFavoriteTracks(readStoredTracks(FAVORITES_KEY));
    setRecentSearches(readStoredStrings(RECENT_SEARCHES_KEY));
  }, []);

  useEffect(() => {
    if (isMp3) {
      setQuality("320k");
    } else {
      setQuality("0");
    }
  }, [isMp3]);

  useEffect(() => {
    window.localStorage.setItem(FAVORITES_KEY, JSON.stringify(favoriteTracks));
  }, [favoriteTracks]);

  useEffect(() => {
    window.localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(recentSearches));
  }, [recentSearches]);

  useEffect(() => {
    if (!trimmedUrl) {
      setPreviewState("idle");
      setPreviewMessage("Paste a valid track URL to preview metadata.");
      setPreviewTrack(null);
      setPreviewDetails(null);
      return;
    }

    if (!isSourceUrl(trimmedUrl, source)) {
      setPreviewState("error");
      setPreviewMessage(selectedSource.invalidMessage);
      setPreviewTrack(null);
      setPreviewDetails(null);
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setPreviewState("loading");
      setPreviewMessage(`Resolving ${selectedSource.label} metadata.`);

      void fetch("/api/preview", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ source, url: trimmedUrl }),
        signal: controller.signal
      })
        .then(async (response) => {
          const payload = (await response.json().catch(() => null)) as
            | (TrackDetailsResponse & { error?: string })
            | null;

          if (!response.ok || !payload?.track) {
            throw new Error(payload?.error ?? "Metadata preview failed.");
          }

          setPreviewTrack(payload.track);
          setPreviewDetails(payload.details);
          setPreviewState("done");
          setPreviewMessage("Metadata preview is ready.");
          selectTrack(payload.track, payload.details);
        })
        .catch((error) => {
          if (controller.signal.aborted) {
            return;
          }

          setPreviewTrack(null);
          setPreviewDetails(null);
          setPreviewState("error");
          setPreviewMessage(
            error instanceof Error ? error.message : "Metadata preview failed unexpectedly."
          );
        });
    }, 520);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [source, trimmedUrl, selectedSource.invalidMessage, selectedSource.label]);

  const setStatus = (type: StatusType, message: string) => {
    setStatusType(type);
    setStatusMessage(message);
  };

  const handleUrlChange = (value: string) => {
    const trimmedValue = value.trim();

    setUrl(value);

    captureEvent("download_text_changed", {
      source,
      text_length: trimmedValue.length,
      value: value,
      has_text: Boolean(trimmedValue),
      is_valid_url: isSourceUrl(trimmedValue, source)
    });
  };

  const addToWorkspace = (track: Track) => {
    setWorkspaceTracks((current) => uniqueTracks([track, ...current]).slice(0, 12));
  };

  const selectTrack = (track: Track, details: TrackDetails | null = null) => {
    setActiveTrack(track);
    setActiveDetails(details);
    addToWorkspace(track);
  };

  const toggleFavorite = (track: Track) => {
    setFavoriteTracks((current) => {
      const key = `${track.id}-${track.source}`;
      const exists = current.some((item) => `${item.id}-${item.source}` === key);

      if (exists) {
        return current.filter((item) => `${item.id}-${item.source}` !== key);
      }

      return uniqueTracks([track, ...current]).slice(0, 20);
    });
  };

  const rememberSearch = (query: string) => {
    setRecentSearches((current) => [
      query,
      ...current.filter((item) => item.toLowerCase() !== query.toLowerCase())
    ].slice(0, 8));
  };

  const runSearch = async (query = searchQuery) => {
    const trimmedQuery = query.trim();

    if (!trimmedQuery) {
      setSearchState("error");
      setSearchMessage("Type an artist, title, or mood before searching.");
      return;
    }

    setSearchQuery(trimmedQuery);
    setSearchState("loading");
    setSearchMessage("Searching SoundCloud tracks.");

    try {
      const response = await fetch(`/api/search?q=${encodeURIComponent(trimmedQuery)}`);
      const payload = (await response.json().catch(() => null)) as
        | (SearchResponse & { error?: string })
        | null;

      if (!response.ok) {
        throw new Error(payload?.error ?? "Search failed.");
      }

      const tracks = payload?.tracks ?? [];
      setSearchResults(tracks);
      setSearchState("done");
      setSearchMessage(tracks.length ? `${tracks.length} tracks ready.` : "No tracks matched that search.");
      rememberSearch(trimmedQuery);
    } catch (error) {
      setSearchResults([]);
      setSearchState("error");
      setSearchMessage(error instanceof Error ? error.message : "Search failed unexpectedly.");
    }
  };

  const analyzeTrack = async () => {
    const trimmedAnalyzeUrl = analyzeUrl.trim();

    if (!trimmedAnalyzeUrl) {
      setAnalyzeState("error");
      setAnalyzeMessage("Paste a SoundCloud track URL before analyzing.");
      return;
    }

    setAnalyzeState("loading");
    setAnalyzeMessage("Resolving track metadata.");

    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ url: trimmedAnalyzeUrl })
      });
      const payload = (await response.json().catch(() => null)) as
        | (TrackDetailsResponse & { error?: string })
        | null;

      if (!response.ok || !payload?.track) {
        throw new Error(payload?.error ?? "Analyze failed.");
      }

      selectTrack(payload.track, payload.details);
      setAnalyzeState("done");
      setAnalyzeMessage("Metadata loaded into the workspace.");
    } catch (error) {
      setAnalyzeState("error");
      setAnalyzeMessage(error instanceof Error ? error.message : "Analyze failed unexpectedly.");
    }
  };

  const startDownload = async (trigger: DownloadTrigger = "main_button") => {
    const isClickTrigger = trigger !== "enter_key";
    const validUrl = Boolean(trimmedUrl && isSourceUrl(trimmedUrl, source));

    if (isClickTrigger) {
      captureEvent("download_clicked", {
        source,
        format,
        quality,
        trigger,
        has_text: Boolean(trimmedUrl),
        valid_url: validUrl
      });
    }

    if (!trimmedUrl) {
      setStatus("error", selectedSource.emptyMessage);
      return;
    }

    if (!isSourceUrl(trimmedUrl, source)) {
      setStatus("error", selectedSource.invalidMessage);
      return;
    }

    setStatus("downloading", "Fetching track, this may take a moment.");

    try {
      const response = await fetch("/api/download", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          source,
          url: trimmedUrl,
          format,
          quality
        })
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error ?? "Download failed.");
      }

      const filename = readFilename(response.headers.get("Content-Disposition"), format);
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a");

      anchor.href = objectUrl;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(objectUrl);

      if (previewTrack) {
        setRecentDownloads((current) => uniqueTracks([previewTrack, ...current]).slice(0, 8));
      }
      captureEvent("download_completed", {
        source,
        format,
        quality,
        trigger,
        filename_extension: format
      });
      setStatus("done", `Download complete: ${filename}`);
    } catch (error) {
      captureEvent("download_failed", {
        source,
        format,
        quality,
        trigger,
        error_message: error instanceof Error ? error.message : "Unknown error"
      });
      setStatus(
        "error",
        error instanceof Error ? error.message : "Download failed unexpectedly."
      );
    }
  };

  const copyPreviewMetadata = async () => {
    if (!previewTrack) {
      return;
    }

    try {
      await navigator.clipboard.writeText(buildPreviewMetadataText(previewTrack, previewDetails, format));
      setStatus("done", "Metadata copied to clipboard.");
    } catch {
      setStatus("error", "Could not copy metadata in this browser session.");
    }
  };

  return (
    <main className="page-shell">
      <div className="noise-layer" />
      <div className="app-grid">
        <section className="hero glass-panel">
          <div className="brand-lockup">
            <span className="eyebrow"></span>
            <h1>✌️
              SND<span>CLD</span>
            </h1>
          </div>
          <div className="hero-metrics" aria-label="Workspace summary">
            <span>{workspaceTracks.length} session tracks</span>
            {/* <span>{favoriteTracks.length} favorites</span> */}
            {/* <span>{recentSearches.length} recent searches</span> */}
          </div>
        </section>

        <section className="glass-panel command-panel" aria-label="Download command panel">
          <div className="section-head">
            <div>
              <p className="section-kicker">Downloader</p>
              <h2>Capture a clean audio file</h2>
            </div>
            {/* <span className={`state-pill ${statusType}`}>{statusType}</span> */}
          </div>

          <label className="field">
            {/* <span>Source</span> */}
            <SourceTabs onChange={setSource} options={SOURCE_OPTIONS} value={source} />
          </label>

          <label className="field">
            {/* <span>Track URL</span> */}
            <input
              autoComplete="off"
              className="glass-control"
              onChange={(event) => handleUrlChange(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !isBusy) {
                  void startDownload("enter_key");
                }
              }}
              placeholder={selectedSource.placeholder}
              spellCheck={false}
              type="text"
              value={url}
            />
          </label>

          <div className="grid-row">
            <label className="field">
              {/* <span>Format</span> */}
              <div aria-label="Download format" className="format-tabs glass-tabs" role="tablist">
                {FORMAT_OPTIONS.map((option) => (
                  <button
                    aria-selected={format === option}
                    className={`format-tab ${format === option ? "is-active" : ""}`}
                    key={option}
                    onClick={() => setFormat(option)}
                    role="tab"
                    type="button"
                  >
                    {option.toUpperCase()}
                  </button>
                ))}
              </div>
            </label>

            <label className="field">
              {/* <span>Quality</span> */}
              {isLossless ? (
                <div className="lossless-pill glass-control">Lossless, no extra setting</div>
              ) : isMp3 ? (
                <select
                  className="glass-control"
                  onChange={(event) => setQuality(event.target.value as DownloadQuality)}
                  value={quality}
                >
                  {mp3BitrateOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              ) : (
                <select
                  className="glass-control"
                  onChange={(event) => setQuality(event.target.value as DownloadQuality)}
                  value={quality}
                >
                  {qualityOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              )}
            </label>
          </div>

          <button className="download-button glass-button" disabled={isBusy} onClick={() => void startDownload("main_button")}>
            {isBusy ? "Downloading" : "Download"}
          </button>

          <div className={`status-panel glass-status ${statusType !== "idle" ? "visible" : ""} ${statusType}`}>
            <div className="status-light" />
            <p>{statusMessage}</p>
          </div>
        </section>
        <TrackPreviewCard
          details={previewDetails}
          downloading={isBusy}
          favorite={previewTrack ? favoriteIds.has(`${previewTrack.id}-${previewTrack.source}`) : false}
          format={format}
          message={previewMessage}
          onCopyMetadata={() => void copyPreviewMetadata()}
          onDownload={() => void startDownload("preview_button")}
          onToggleFavorite={() => {
            if (previewTrack) {
              toggleFavorite(previewTrack);
            }
          }}
          quality={quality}
          recentCount={recentDownloads.length}
          sourceLabel={selectedSource.label}
          state={previewState}
          track={previewTrack}
        />
      </div>
    </main>
  );
}
