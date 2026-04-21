# SoundCloud Downloader

Simple localhost SoundCloud downloader with a URL form, format selection, and direct browser download. No SoundCloud client ID is required.

## Requirements

- Node.js
- `yt-dlp`
- `ffmpeg`

On Windows, make sure `yt-dlp.exe` and `ffmpeg.exe` are available in PowerShell `PATH`.

## Setup

```bash
npm install
```

Optional `.env`:

```env
PORT=3217
# Optional override if yt-dlp is not in PATH:
# YT_DLP_PATH=C:\tools\yt-dlp.exe
```

## Run

Development:

```bash
npm run dev
```

Frontend: `http://localhost:5217`

Backend: `http://localhost:3217`

Production build:

```bash
npm run build
npm start
```

## Deploy To Railway

This repo is set up to deploy as a single Railway service using the root `Dockerfile`.

1. Push this folder to a GitHub repository.
2. In Railway, create a new project and choose `Deploy from GitHub repo`.
3. Select this repository. Railway will detect the `Dockerfile` and build the app as a container.
4. Add any environment variables you want:

```env
PORT=3217
# Optional if you want to override the bundled yt-dlp binary:
# YT_DLP_PATH=/usr/local/bin/yt-dlp
```

5. Open the generated Railway domain after the deployment finishes.

Notes:

- The Express server serves the built frontend from `client/dist`, so only one Railway service is needed.
- `ffmpeg` and `yt-dlp` are installed in the container during the Docker build.
- The app exposes `/api/health`, which can be used for a Railway health check.
- If you publish this publicly, anyone with the URL can hit the download endpoint unless you add auth.

## API

- `GET /api/health`
- `POST /api/download`

Request body:

```json
{
  "url": "https://soundcloud.com/artist/track",
  "format": "mp3",
  "quality": "0"
}
```

`quality` is ignored for `flac` and `wav`.

## Notes

- The server shells out to `yt-dlp` and streams the finished file back to the browser.
- Temporary files are created in the OS temp directory and removed after the response finishes.
- If `yt-dlp` is missing, the server returns a Windows-specific error message explaining what to install.
