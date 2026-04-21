import { useEffect, useRef, useState } from "react";
import type { Track, TrackDetailsResponse } from "./types";

const LOSSLESS_FORMATS = new Set(["flac", "wav"]);

type DownloadFormat = "mp3" | "aac" | "opus" | "m4a" | "flac" | "wav";
type DownloadQuality = "0" | "2" | "5" | "7" | "9";
type StatusType = "idle" | "downloading" | "done" | "error";

const qualityOptions: Array<{ value: DownloadQuality; label: string }> = [
  { value: "0", label: "Best, around 245 kbps" },
  { value: "2", label: "High, around 190 kbps" },
  { value: "5", label: "Medium, around 130 kbps" },
  { value: "7", label: "Low, around 100 kbps" },
  { value: "9", label: "Worst, around 65 kbps" }
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

export default function App() {
  const [url, setUrl] = useState("");
  const [format, setFormat] = useState<DownloadFormat>("mp3");
  const [quality, setQuality] = useState<DownloadQuality>("0");
  const [statusType, setStatusType] = useState<StatusType>("idle");
  const [statusMessage, setStatusMessage] = useState(
    "Paste a SoundCloud track URL, choose a format, and download it."
  );
  const [trackDetails, setTrackDetails] = useState<TrackDetailsResponse | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [detailsError, setDetailsError] = useState("");
  const detailsRequestRef = useRef(0);

  const isLossless = LOSSLESS_FORMATS.has(format);
  const isBusy = statusType === "downloading";
  const trimmedUrl = url.trim();
  const looksLikeSoundCloudUrl =
    trimmedUrl.includes("soundcloud.com") || trimmedUrl.includes("snd.sc");

  const setStatus = (type: StatusType, message: string) => {
    setStatusType(type);
    setStatusMessage(message);
  };

  useEffect(() => {
    if (!trimmedUrl || !looksLikeSoundCloudUrl) {
      setTrackDetails(null);
      setDetailsError("");
      setDetailsLoading(false);
      return;
    }

    const requestId = detailsRequestRef.current + 1;
    detailsRequestRef.current = requestId;
    setDetailsLoading(true);
    setDetailsError("");

    const timeoutId = window.setTimeout(() => {
      void (async () => {
        try {
          const response = await fetch("/api/track-details", {
            method: "POST",
            headers: {
              "Content-Type": "application/json"
            },
            body: JSON.stringify({ url: trimmedUrl })
          });

          const payload = (await response.json().catch(() => null)) as
            | (TrackDetailsResponse & { error?: string })
            | { error?: string }
            | null;

          if (detailsRequestRef.current !== requestId) {
            return;
          }

          if (!response.ok || !payload || !("track" in payload) || !("details" in payload)) {
            throw new Error(payload?.error ?? "Could not fetch track details.");
          }

          setTrackDetails(payload);
        } catch (error) {
          if (detailsRequestRef.current !== requestId) {
            return;
          }

          setTrackDetails(null);
          setDetailsError(
            error instanceof Error ? error.message : "Could not fetch track details."
          );
        } finally {
          if (detailsRequestRef.current === requestId) {
            setDetailsLoading(false);
          }
        }
      })();
    }, 450);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [looksLikeSoundCloudUrl, trimmedUrl]);

  const startDownload = async () => {
    if (!trimmedUrl) {
      setStatus("error", "Paste a SoundCloud URL first.");
      return;
    }

    if (!trimmedUrl.includes("soundcloud.com") && !trimmedUrl.includes("snd.sc")) {
      setStatus("error", "That does not look like a SoundCloud link.");
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

      setStatus("done", `Download complete: ${filename}`);
    } catch (error) {
      setStatus(
        "error",
        error instanceof Error ? error.message : "Download failed unexpectedly."
      );
    }
  };

  return (
    <main className="page-shell">
      <div className="noise-layer" />
      <section className="hero">
        <p className="eyebrow">Local downloader</p>
        <h1>
          SND<span>CLD</span>
        </h1>
        <p className="hero-copy">Simple SoundCloud downloading on Windows, no client ID required.</p>
      </section>

      <section className="card">
        <label className="field">
          <span>Track URL</span>
          <input
            autoComplete="off"
            onChange={(event) => setUrl(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !isBusy) {
                void startDownload();
              }
            }}
            placeholder="https://soundcloud.com/artist/track"
            spellCheck={false}
            type="text"
            value={url}
          />
        </label>

        {looksLikeSoundCloudUrl ? (
          <section className="track-details-panel">
            <div className="track-details-head">
              <span>Track Details</span>
              <span className={`detail-state ${detailsLoading ? "is-live" : ""}`}>
                {detailsLoading ? "Fetching..." : trackDetails ? "Ready" : "Waiting"}
              </span>
            </div>

            {detailsError ? <p className="detail-error">{detailsError}</p> : null}

            {trackDetails ? (
              <>
                <TrackSummary track={trackDetails.track} details={trackDetails.details} />

                {typeof trackDetails.details.description === "string" &&
                trackDetails.details.description.trim() ? (
                  <div className="detail-block">
                    <h3>Description</h3>
                    <p>{trackDetails.details.description}</p>
                  </div>
                ) : null}

                <div className="detail-block">
                  <h3>Full server payload</h3>
                  <pre>{JSON.stringify(trackDetails.details, null, 2)}</pre>
                </div>
              </>
            ) : null}
          </section>
        ) : null}

        <div className="grid-row">
          <label className="field">
            <span>Format</span>
            <select
              onChange={(event) => setFormat(event.target.value as DownloadFormat)}
              value={format}
            >
              <option value="mp3">MP3</option>
              <option value="aac">AAC</option>
              <option value="opus">OPUS</option>
              <option value="m4a">M4A</option>
              <option value="flac">FLAC</option>
              <option value="wav">WAV</option>
            </select>
          </label>

          <label className="field">
            <span>Quality</span>
            {isLossless ? (
              <div className="lossless-pill">Lossless, no extra quality setting</div>
            ) : (
              <select
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

        <p className="note">
          Requires <code>yt-dlp</code> and <code>ffmpeg</code> in PATH. On Windows, install
          <code> yt-dlp.exe</code> and make sure both commands work in PowerShell.
        </p>

        <button className="download-button" disabled={isBusy} onClick={() => void startDownload()}>
          {isBusy ? "DOWNLOADING" : "DOWNLOAD"}
        </button>

        <div className={`status-panel ${statusType !== "idle" ? "visible" : ""} ${statusType}`}>
          <div className="status-dot" />
          <p>{statusMessage}</p>
        </div>
      </section>
    </main>
  );
}

function TrackSummary({
  track,
  details
}: {
  track: Track;
  details: TrackDetailsResponse["details"];
}) {
  const artistProfile =
    typeof details.user?.permalink_url === "string" ? details.user.permalink_url : "";

  return (
    <div className="track-summary">
      {track.artworkUrl ? <img alt={track.title} className="track-artwork" src={track.artworkUrl} /> : null}

      <div className="track-summary-copy">
        <h2>{track.title}</h2>
        <p>{track.artist}</p>
        <div className="track-meta-grid">
          <span>Duration: {track.playbackLabel}</span>
          <span>Quality: {track.qualityHint}</span>
          {details.genre ? <span>Genre: {details.genre}</span> : null}
          {typeof details.likes_count === "number" ? (
            <span>Likes: {details.likes_count.toLocaleString()}</span>
          ) : null}
          {typeof details.playback_count === "number" ? (
            <span>Plays: {details.playback_count.toLocaleString()}</span>
          ) : null}
          {typeof details.comment_count === "number" ? (
            <span>Comments: {details.comment_count.toLocaleString()}</span>
          ) : null}
        </div>
        {artistProfile ? (
          <a className="track-link" href={artistProfile} rel="noreferrer" target="_blank">
            Artist profile
          </a>
        ) : null}
      </div>
    </div>
  );
}
