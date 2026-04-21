import { useEffect, useState } from "react";

const LOSSLESS_FORMATS = new Set(["flac", "wav"]);
const MP3_BITRATES = ["128k", "192k", "256k", "320k"] as const;
const FORMAT_OPTIONS = ["mp3", "flac", "wav"] as const;

type DownloadFormat = typeof FORMAT_OPTIONS[number];
type DownloadQuality = "0" | "2" | "5" | "7" | "9" | "128k" | "192k" | "256k" | "320k";
type StatusType = "idle" | "downloading" | "done" | "error";

const qualityOptions: Array<{ value: "0" | "2" | "5" | "7" | "9"; label: string }> = [
  { value: "0", label: "Best, around 245 kbps" },
  { value: "2", label: "High, around 190 kbps" },
  { value: "5", label: "Medium, around 130 kbps" },
  { value: "7", label: "Low, around 100 kbps" },
  { value: "9", label: "Worst, around 65 kbps" }
];

const mp3BitrateOptions: Array<{ value: typeof MP3_BITRATES[number]; label: string }> = [
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

export default function App() {
  const [url, setUrl] = useState("");
  const [format, setFormat] = useState<DownloadFormat>("mp3");
  const [quality, setQuality] = useState<DownloadQuality>("320k");
  const [statusType, setStatusType] = useState<StatusType>("idle");
  const [statusMessage, setStatusMessage] = useState(
    "Paste a SoundCloud track URL, choose a format, and download it."
  );

  const isLossless = LOSSLESS_FORMATS.has(format);
  const isMp3 = format === "mp3";
  const isBusy = statusType === "downloading";
  const trimmedUrl = url.trim();
  const looksLikeSoundCloudUrl =
    trimmedUrl.includes("soundcloud.com") || trimmedUrl.includes("snd.sc");

  // Reset quality when format changes
  useEffect(() => {
    if (isMp3) {
      setQuality("320k");
    } else {
      setQuality("0");
    }
  }, [isMp3]);

  const setStatus = (type: StatusType, message: string) => {
    setStatusType(type);
    setStatusMessage(message);
  };

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
        <p className="eyebrow">✌️</p>
        <h1>
          SND<span>CLD</span>
        </h1>
        {/* <p className="hero-copy">Simple SoundCloud downloading, powered by yt-dlp. Works locally or in the cloud.</p> */}
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

        <div className="grid-row">
          <label className="field">
            <span>Format</span>
            <div
              aria-label="Download format"
              className="format-tabs"
              role="tablist"
            >
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
            <span>Quality</span>
            {isLossless ? (
              <div className="lossless-pill">Lossless, no extra quality setting</div>
            ) : isMp3 ? (
              <select
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

        <p className="note"></p>

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
