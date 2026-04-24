import express from "express";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { config } from "./config.js";
import { analyzeTrackUrl, assertClientId, searchTracks } from "./soundcloud.js";
import type { NormalizedTrack, QualityHint } from "./types.js";

const app = express();
const currentDir = path.dirname(fileURLToPath(import.meta.url));
const clientDistDir = path.resolve(currentDir, "../../client/dist");
const ALLOWED_FORMATS = ["mp3", "aac", "opus", "flac", "wav", "m4a"] as const;
const LOSSLESS_FORMATS = ["flac", "wav"] as const;
const ALLOWED_QUALITIES = ["0", "2", "5", "7", "9"] as const;
const MP3_BITRATES = ["128k", "192k", "256k", "320k"] as const;
const ALLOWED_SOURCES = ["soundcloud", "youtube"] as const;

type DownloadSource = (typeof ALLOWED_SOURCES)[number];
type YtDlpInfo = {
  [key: string]: unknown;
  id?: string | number;
  title?: string;
  artist?: string;
  uploader?: string;
  channel?: string;
  duration?: number;
  duration_string?: string;
  thumbnail?: string;
  thumbnails?: Array<{ url?: string }>;
  webpage_url?: string;
  original_url?: string;
  acodec?: string;
  abr?: number;
  ext?: string;
  upload_date?: string;
  timestamp?: number;
  view_count?: number;
  like_count?: number;
  categories?: string[];
  tags?: string[];
  age_limit?: number;
  channel_is_verified?: boolean;
  entries?: YtDlpInfo[];
};

app.disable("x-powered-by");
app.use(express.json({ limit: "16kb" }));

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

function getSoundCloudClientId() {
  assertClientId(config.soundCloudClientId);
  return config.soundCloudClientId;
}

app.get("/api/search", async (req, res) => {
  const query = typeof req.query.q === "string" ? req.query.q.trim() : "";

  if (!query) {
    res.status(400).json({ error: "Missing search query." });
    return;
  }

  try {
    const tracks = await searchTracks(query, getSoundCloudClientId());
    res.json({ tracks });
  } catch (error) {
    res.status(400).json({
      error: error instanceof Error ? error.message : "Search failed."
    });
  }
});

app.post("/api/analyze", async (req, res) => {
  const url = typeof req.body?.url === "string" ? req.body.url.trim() : "";

  if (!url) {
    res.status(400).json({ error: "Missing URL." });
    return;
  }

  try {
    const payload = await analyzeTrackUrl(url, getSoundCloudClientId());
    res.json(payload);
  } catch (error) {
    res.status(400).json({
      error: error instanceof Error ? error.message : "Analyze failed."
    });
  }
});

function isSoundCloudUrl(value: string) {
  try {
    const parsed = new URL(value);
    const hostname = parsed.hostname.toLowerCase();

    return (
      (parsed.protocol === "https:" || parsed.protocol === "http:") &&
      (hostname === "soundcloud.com" ||
        hostname.endsWith(".soundcloud.com") ||
        hostname === "on.soundcloud.com" ||
        hostname === "snd.sc")
    );
  } catch {
    return false;
  }
}

function isYouTubeUrl(value: string) {
  try {
    const parsed = new URL(value);
    const hostname = parsed.hostname.toLowerCase();

    return (
      (parsed.protocol === "https:" || parsed.protocol === "http:") &&
      (hostname === "youtube.com" ||
        hostname.endsWith(".youtube.com") ||
        hostname === "youtu.be")
    );
  } catch {
    return false;
  }
}

function isValidSourceUrl(value: string, source: DownloadSource) {
  return source === "soundcloud" ? isSoundCloudUrl(value) : isYouTubeUrl(value);
}

function getSourceLabel(source: DownloadSource) {
  return source === "soundcloud" ? "SoundCloud" : "YouTube";
}

function formatDuration(durationSeconds: number) {
  const totalSeconds = Math.max(0, Math.round(durationSeconds));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, "0")}:${seconds
      .toString()
      .padStart(2, "0")}`;
  }

  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function readDurationSeconds(info: YtDlpInfo) {
  if (typeof info.duration === "number" && Number.isFinite(info.duration)) {
    return info.duration;
  }

  if (typeof info.duration_string === "string") {
    const parts = info.duration_string.split(":").map((part) => Number.parseInt(part, 10));

    if (parts.every((part) => Number.isFinite(part))) {
      return parts.reduce((total, part) => total * 60 + part, 0);
    }
  }

  return 0;
}

function readBestThumbnail(info: YtDlpInfo) {
  const thumbnail = typeof info.thumbnail === "string" ? info.thumbnail : null;
  const fromList = Array.isArray(info.thumbnails)
    ? [...info.thumbnails].reverse().find((item) => typeof item.url === "string")?.url
    : null;

  return fromList ?? thumbnail;
}

function derivePreviewQuality(info: YtDlpInfo): QualityHint {
  const codec = `${info.acodec ?? ""} ${info.ext ?? ""}`.toLowerCase();
  const bitrate = typeof info.abr === "number" ? info.abr : 0;

  if (/\b(flac|alac|wav|pcm|aiff)\b/.test(codec) || bitrate >= 256) {
    return "high";
  }

  if (codec.trim() || bitrate > 0) {
    return "standard";
  }

  return "unknown";
}

function compactPreviewDetails(info: YtDlpInfo) {
  return {
    title: info.title,
    uploader: info.uploader,
    channel: info.channel,
    upload_date: info.upload_date,
    created_at: typeof info.timestamp === "number" ? new Date(info.timestamp * 1000).toISOString() : undefined,
    view_count: info.view_count,
    like_count: info.like_count,
    acodec: info.acodec,
    abr: info.abr,
    ext: info.ext,
    duration_string: info.duration_string,
    categories: info.categories,
    tags: info.tags,
    age_limit: info.age_limit,
    channel_is_verified: info.channel_is_verified,
    webpage_url: info.webpage_url,
    original_url: info.original_url
  };
}

function normalizePreviewInfo(info: YtDlpInfo, url: string) {
  const resolved = Array.isArray(info.entries) && info.entries[0] ? info.entries[0] : info;
  const durationSeconds = readDurationSeconds(resolved);
  const permalinkUrl =
    typeof resolved.webpage_url === "string"
      ? resolved.webpage_url
      : typeof resolved.original_url === "string"
        ? resolved.original_url
        : url;

  return {
    track: {
      id: String(resolved.id ?? permalinkUrl),
      title: resolved.title?.trim() || "Untitled track",
      artist: resolved.artist?.trim() || resolved.uploader?.trim() || resolved.channel?.trim() || "Unknown artist",
      durationMs: durationSeconds * 1000,
      artworkUrl: readBestThumbnail(resolved),
      permalinkUrl,
      embedUrl: null,
      qualityHint: derivePreviewQuality(resolved),
      waveformUrl: null,
      playbackLabel: formatDuration(durationSeconds),
      source: "url"
    },
    details: compactPreviewDetails(resolved)
  };
}

function runYtDlpJson(url: string) {
  return new Promise<YtDlpInfo>((resolve, reject) => {
    const ytdlp = spawn(resolveYtDlpBinary(), [
      "--dump-single-json",
      "--skip-download",
      "--no-playlist",
      url
    ]);
    const timeout = setTimeout(() => {
      settled = true;
      ytdlp.kill("SIGTERM");
      reject(new Error("Metadata preview timed out. Try again in a moment."));
    }, 20000);

    let stdout = "";
    let stderr = "";
    let settled = false;

    ytdlp.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });

    ytdlp.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    ytdlp.on("error", (error) => {
      clearTimeout(timeout);
      settled = true;
      reject(error);
    });

    ytdlp.on("close", (code) => {
      clearTimeout(timeout);
      if (settled) {
        return;
      }

      if (code !== 0) {
        reject(new Error(stderr.trim() || "yt-dlp could not read metadata."));
        return;
      }

      try {
        resolve(JSON.parse(stdout) as YtDlpInfo);
      } catch {
        reject(new Error("yt-dlp returned unreadable metadata."));
      }
    });
  });
}

function cleanup(dir: string) {
  try {
    fs.rmSync(dir, { recursive: true, force: true });
  } catch {
    // ignore temp cleanup failures
  }
}

function toSafeDownloadName(filename: string) {
  const parsed = path.parse(filename);
  const safeBase = parsed.name
    .normalize("NFKD")
    .replace(/[^\x20-\x7E]/g, "")
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);

  const fallbackBase = safeBase || "track";
  return `${fallbackBase}${parsed.ext}`;
}

function classifyYtDlpFailure(stderr: string, source: DownloadSource) {
  const message = stderr.trim();
  const sourceLabel = getSourceLabel(source);

  if (/404: not found|unable to download json metadata/i.test(message)) {
    return {
      status: 400,
      error:
        `${sourceLabel} could not resolve that track URL. The track may be unavailable, private, or the link may be wrong.`
    };
  }

  if (/private|login required|sign in/i.test(message)) {
    return {
      status: 400,
      error: `That ${sourceLabel} track is private or requires access that yt-dlp does not have.`
    };
  }

  return {
    status: 500,
    error: `yt-dlp failed.\n${message.slice(-500) || "Unknown error."}`
  };
}

function resolveYtDlpBinary() {
  return process.env.YT_DLP_PATH?.trim() || "yt-dlp";
}

app.post("/api/preview", async (req, res) => {
  const source = typeof req.body?.source === "string" ? req.body.source.trim() : "soundcloud";
  const url = typeof req.body?.url === "string" ? req.body.url.trim() : "";

  if (!url) {
    res.status(400).json({ error: "Missing URL." });
    return;
  }

  if (!ALLOWED_SOURCES.includes(source as DownloadSource)) {
    res.status(400).json({ error: "Invalid source." });
    return;
  }

  const previewSource = source as DownloadSource;

  if (!isValidSourceUrl(url, previewSource)) {
    res.status(400).json({ error: `URL must be a ${getSourceLabel(previewSource)} link.` });
    return;
  }

  try {
    const info = await runYtDlpJson(url);
    res.json(normalizePreviewInfo(info, url));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      res.status(500).json({
        error:
          "yt-dlp was not found in PATH, so metadata preview cannot run on this machine."
      });
      return;
    }

    res.status(400).json({
      error: error instanceof Error ? error.message.slice(-500) : "Metadata preview failed."
    });
  }
});

app.post("/api/download", (req, res) => {
  const source = typeof req.body?.source === "string" ? req.body.source.trim() : "soundcloud";
  const url = typeof req.body?.url === "string" ? req.body.url.trim() : "";
  const format = typeof req.body?.format === "string" ? req.body.format.trim() : "";
  const quality =
    typeof req.body?.quality === "string" || typeof req.body?.quality === "number"
      ? String(req.body.quality).trim()
      : "";

  if (!url) {
    res.status(400).json({ error: "Missing URL." });
    return;
  }

  if (!ALLOWED_SOURCES.includes(source as DownloadSource)) {
    res.status(400).json({ error: "Invalid source." });
    return;
  }

  const downloadSource = source as DownloadSource;

  if (!isValidSourceUrl(url, downloadSource)) {
    res.status(400).json({ error: `URL must be a ${getSourceLabel(downloadSource)} link.` });
    return;
  }

  if (!ALLOWED_FORMATS.includes(format as (typeof ALLOWED_FORMATS)[number])) {
    res.status(400).json({ error: "Invalid format." });
    return;
  }

  const isLossless = LOSSLESS_FORMATS.includes(
    format as (typeof LOSSLESS_FORMATS)[number]
  );
  const isMp3 = format === "mp3";

  if (!isLossless) {
    if (isMp3 && !MP3_BITRATES.includes(quality as (typeof MP3_BITRATES)[number])) {
      res.status(400).json({ error: "Invalid bitrate value." });
      return;
    } else if (!isMp3 && !ALLOWED_QUALITIES.includes(quality as (typeof ALLOWED_QUALITIES)[number])) {
      res.status(400).json({ error: "Invalid quality value." });
      return;
    }
  }

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "sndcld-"));
  const outTemplate = path.join(tmpDir, "%(title)s.%(ext)s");
  const args = [
    "-x",
    "--format",
    "bestaudio",
    "--audio-format",
    format,
    "--output",
    outTemplate,
    "--no-playlist"
  ];

  if (!isLossless) {
    if (isMp3) {
      args.push("--postprocessor-args", `ffmpeg:-b:a ${quality}`);
    } else {
      args.push("--audio-quality", quality);
    }
  }

  args.push(url);

  const ytdlp = spawn(resolveYtDlpBinary(), args);

  let stderr = "";

  ytdlp.stderr.on("data", (chunk) => {
    stderr += chunk.toString();
  });

  ytdlp.on("error", (error) => {
    cleanup(tmpDir);

    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      res.status(500).json({
        error:
          "yt-dlp was not found in PATH. Ensure yt-dlp and ffmpeg are installed and available in your PATH."
      });
      return;
    }

    res.status(500).json({
      error: error.message || "Failed to start yt-dlp."
    });
  });

  ytdlp.on("close", (code) => {
    if (code !== 0) {
      cleanup(tmpDir);
      const failure = classifyYtDlpFailure(stderr, downloadSource);
      res.status(failure.status).json({ error: failure.error });
      return;
    }

    let files: string[] = [];

    try {
      files = fs.readdirSync(tmpDir);
    } catch {
      cleanup(tmpDir);
      res.status(500).json({ error: "Could not read the output directory." });
      return;
    }

    if (!files.length) {
      cleanup(tmpDir);
      res.status(500).json({ error: "No output file was created." });
      return;
    }

    const filename = files[0];
    const filePath = path.join(tmpDir, filename);
    const downloadName = toSafeDownloadName(filename);

    res.download(filePath, downloadName, (error) => {
      cleanup(tmpDir);

      if (error) {
        console.error("[download]", error.message);
      }
    });
  });
});

app.use(express.static(clientDistDir));

app.get("*", (_req, res) => {
  res.sendFile(path.join(clientDistDir, "index.html"));
});

app.listen(config.port, config.host, () => {
  console.log(`Audio downloader ready at http://${config.host}:${config.port}`);
});
