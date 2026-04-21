import type { NormalizedTrack, QualityHint, SoundCloudTrack } from "./types.js";

const OEMBED_ENDPOINT = "https://soundcloud.com/oembed";
const API_BASE = "https://api.soundcloud.com";
const DEFAULT_ARTWORK =
  "https://placehold.co/400x400/1b1b22/f1ede4?text=SoundCloud";

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

function extractEmbedUrl(html: string | undefined) {
  if (!html) {
    return null;
  }

  const match = html.match(/src="([^"]+)"/i);
  return match?.[1] ?? null;
}

async function fetchJson<T>(url: string) {
  const response = await fetch(url, {
    headers: {
      Accept: "application/json"
    }
  });

  if (!response.ok) {
    throw new Error(`SoundCloud request failed with ${response.status}.`);
  }

  return (await response.json()) as T;
}

function deriveQualityHint(track: SoundCloudTrack): QualityHint {
  const transcodings = track.media?.transcodings ?? [];
  const presets = transcodings.map((item) => item.preset?.toLowerCase() ?? "");
  const hasHighPreset = presets.some(
    (preset) =>
      preset.includes("aac_160") ||
      preset.includes("hls_aac_160") ||
      preset.includes("hq")
  );

  if (hasHighPreset) {
    return "high";
  }

  if (transcodings.length > 0 || track.waveform_url) {
    return "standard";
  }

  return "unknown";
}

function formatDuration(durationMs: number) {
  const totalSeconds = Math.max(0, Math.round(durationMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

async function fetchOEmbed(url: string) {
  const oembedUrl = new URL(OEMBED_ENDPOINT);
  oembedUrl.searchParams.set("format", "json");
  oembedUrl.searchParams.set("url", url);
  oembedUrl.searchParams.set("maxheight", "180");

  return fetchJson<{ html?: string }>(oembedUrl.toString());
}

export function assertClientId(clientId: string) {
  if (!clientId) {
    throw new Error(
      "Missing SOUNDCLOUD_CLIENT_ID. Add it to your environment before using search or URL analysis."
    );
  }
}

function normalizeTrack(
  track: SoundCloudTrack,
  embedUrl: string | null,
  source: "search" | "url"
): NormalizedTrack {
  const durationMs = track.duration ?? 0;

  return {
    id: track.urn ?? String(track.id),
    title: track.title || "Untitled track",
    artist: track.user?.username || "Unknown artist",
    durationMs,
    artworkUrl: track.artwork_url || DEFAULT_ARTWORK,
    permalinkUrl: track.permalink_url || "",
    embedUrl,
    qualityHint: deriveQualityHint(track),
    waveformUrl: track.waveform_url ?? null,
    playbackLabel: formatDuration(durationMs),
    source
  };
}

export async function searchTracks(query: string, clientId: string) {
  const url = new URL(`${API_BASE}/tracks`);
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("q", query);
  url.searchParams.set("limit", "12");
  url.searchParams.set("linked_partitioning", "1");

  const payload = await fetchJson<SoundCloudTrack[]>(url.toString());
  const tracks = payload.filter((track) => track.permalink_url);

  return Promise.all(
    tracks.map(async (track) => {
      const oembed = track.permalink_url
        ? await fetchOEmbed(track.permalink_url).catch(() => ({ html: undefined }))
        : { html: undefined };

      return normalizeTrack(track, extractEmbedUrl(oembed.html), "search");
    })
  );
}

export async function analyzeTrackUrl(trackUrl: string, clientId: string) {
  if (!isSoundCloudUrl(trackUrl)) {
    throw new Error("Enter a valid SoundCloud track URL.");
  }

  const resolveUrl = new URL(`${API_BASE}/resolve`);
  resolveUrl.searchParams.set("url", trackUrl);
  resolveUrl.searchParams.set("client_id", clientId);

  const [track, oembed] = await Promise.all([
    fetchJson<SoundCloudTrack>(resolveUrl.toString()),
    fetchOEmbed(trackUrl)
  ]);

  if (!track.permalink_url) {
    throw new Error("That SoundCloud URL did not resolve to a track.");
  }

  return {
    track: normalizeTrack(track, extractEmbedUrl(oembed.html), "url"),
    details: track
  };
}
