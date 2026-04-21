# SoundCloud Downloader

Simple localhost SoundCloud downloader with a URL form, format selection, and direct browser download. No SoundCloud client ID is required.

## Requirements

- Node.js
- `yt-dlp`
- `ffmpeg`

## Setup

### macOS (Local Development)

**Install dependencies via Homebrew:**

```bash
brew install yt-dlp ffmpeg
```

**Install Node.js dependencies:**

```bash
npm install
```

**Optional `.env` configuration:**

```env
PORT=3217
# Optional: override yt-dlp binary path if not in PATH
# YT_DLP_PATH=/usr/local/bin/yt-dlp
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

## Worldwide Deployment (Docker/Railway)

This repo is set up to deploy as a single Docker container using the root `Dockerfile`. The app runs on any cloud platform that supports Docker (Railway, Vercel, AWS, Google Cloud, etc.).

### Deploy to Railway

1. Push this folder to a GitHub repository.
2. In Railway, create a new project and choose `Deploy from GitHub repo`.
3. Select this repository. Railway will detect the `Dockerfile` and build the app as a container.
4. Add environment variables (optional):

```env
PORT=3217
# Optional: override yt-dlp binary path (for Railway: /usr/local/bin/yt-dlp is pre-installed)
# YT_DLP_PATH=/usr/local/bin/yt-dlp
```

5. Railway will generate a public domain URL after deployment finishes (e.g., `https://song-sec-prod.railway.app`).
6. Open the domain in your browser to access the app—works on desktop, tablet, or iPhone.

### Other Cloud Platforms

Any platform that supports Docker containers works:
- **Vercel** (with serverless functions or custom Docker)
- **AWS** (ECS, Fargate, or Elastic Beanstalk)
- **Google Cloud Run** (fully managed serverless)
- **DigitalOcean** (App Platform or Docker-on-Droplets)
- **Render**, **Fly.io**, **Replit**, or similar Docker-based services

### Notes

- The Express server serves the built frontend from `client/dist`, so only one service instance is needed.
- `ffmpeg` and `yt-dlp` are installed in the container during Docker build.
- The app exposes `/api/health` for health checks (useful for auto-restart on cloud platforms).
- If published publicly without auth, anyone with the URL can hit the download endpoint (see security note below).

## Access from iPhone & Mobile Devices

Once deployed to a cloud platform, you can access the app from any device with a web browser:

1. **Copy the public URL** from your deployment platform (e.g., Railway generates something like `https://song-sec-prod.railway.app`).
2. **Open the URL in Safari, Chrome, or any browser** on your iPhone, iPad, or Android device.
3. **Paste a SoundCloud track URL**, select format/quality, and download directly to your device.

The app works on all modern browsers and automatically adjusts for mobile screen sizes.

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
- No SoundCloud API credentials required—`yt-dlp` bypasses SoundCloud's official API entirely.
- For public deployments, consider adding rate limiting or authentication to prevent abuse.
