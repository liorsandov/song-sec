import express from "express";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { config } from "./config.js";

const app = express();
const currentDir = path.dirname(fileURLToPath(import.meta.url));
const clientDistDir = path.resolve(currentDir, "../../client/dist");
const ALLOWED_FORMATS = ["mp3", "aac", "opus", "flac", "wav", "m4a"] as const;
const LOSSLESS_FORMATS = ["flac", "wav"] as const;
const ALLOWED_QUALITIES = ["0", "2", "5", "7", "9"] as const;
const MP3_BITRATES = ["128k", "192k", "256k", "320k"] as const;

app.disable("x-powered-by");
app.use(express.json({ limit: "16kb" }));

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
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

function classifyYtDlpFailure(stderr: string) {
  const message = stderr.trim();

  if (/404: not found|unable to download json metadata/i.test(message)) {
    return {
      status: 400,
      error:
        "SoundCloud could not resolve that track URL. The track may be unavailable, private, or the link may be wrong."
    };
  }

  if (/private|login required|sign in/i.test(message)) {
    return {
      status: 400,
      error: "That SoundCloud track is private or requires access that yt-dlp does not have."
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

app.post("/api/download", (req, res) => {
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

  if (!isSoundCloudUrl(url)) {
    res.status(400).json({ error: "URL must be a SoundCloud link." });
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
      const failure = classifyYtDlpFailure(stderr);
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
  console.log(`SoundCloud downloader ready at http://${config.host}:${config.port}`);
});
