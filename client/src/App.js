import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useRef, useState } from "react";
const LOSSLESS_FORMATS = new Set(["flac", "wav"]);
const qualityOptions = [
    { value: "0", label: "Best, around 245 kbps" },
    { value: "2", label: "High, around 190 kbps" },
    { value: "5", label: "Medium, around 130 kbps" },
    { value: "7", label: "Low, around 100 kbps" },
    { value: "9", label: "Worst, around 65 kbps" }
];
function readFilename(disposition, fallbackFormat) {
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
    const [format, setFormat] = useState("mp3");
    const [quality, setQuality] = useState("0");
    const [statusType, setStatusType] = useState("idle");
    const [statusMessage, setStatusMessage] = useState("Paste a SoundCloud track URL, choose a format, and download it.");
    const [trackDetails, setTrackDetails] = useState(null);
    const [detailsLoading, setDetailsLoading] = useState(false);
    const [detailsError, setDetailsError] = useState("");
    const detailsRequestRef = useRef(0);
    const isLossless = LOSSLESS_FORMATS.has(format);
    const isBusy = statusType === "downloading";
    const trimmedUrl = url.trim();
    const looksLikeSoundCloudUrl = trimmedUrl.includes("soundcloud.com") || trimmedUrl.includes("snd.sc");
    const setStatus = (type, message) => {
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
                    const payload = (await response.json().catch(() => null));
                    if (detailsRequestRef.current !== requestId) {
                        return;
                    }
                    if (!response.ok || !payload || !("track" in payload) || !("details" in payload)) {
                        throw new Error(payload?.error ?? "Could not fetch track details.");
                    }
                    setTrackDetails(payload);
                }
                catch (error) {
                    if (detailsRequestRef.current !== requestId) {
                        return;
                    }
                    setTrackDetails(null);
                    setDetailsError(error instanceof Error ? error.message : "Could not fetch track details.");
                }
                finally {
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
                const payload = (await response.json().catch(() => null));
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
        }
        catch (error) {
            setStatus("error", error instanceof Error ? error.message : "Download failed unexpectedly.");
        }
    };
    return (_jsxs("main", { className: "page-shell", children: [_jsx("div", { className: "noise-layer" }), _jsxs("section", { className: "hero", children: [_jsx("p", { className: "eyebrow", children: "Local downloader" }), _jsxs("h1", { children: ["SND", _jsx("span", { children: "CLD" })] }), _jsx("p", { className: "hero-copy", children: "Simple SoundCloud downloading on Windows, no client ID required." })] }), _jsxs("section", { className: "card", children: [_jsxs("label", { className: "field", children: [_jsx("span", { children: "Track URL" }), _jsx("input", { autoComplete: "off", onChange: (event) => setUrl(event.target.value), onKeyDown: (event) => {
                                    if (event.key === "Enter" && !isBusy) {
                                        void startDownload();
                                    }
                                }, placeholder: "https://soundcloud.com/artist/track", spellCheck: false, type: "text", value: url })] }), looksLikeSoundCloudUrl ? (_jsxs("section", { className: "track-details-panel", children: [_jsxs("div", { className: "track-details-head", children: [_jsx("span", { children: "Track Details" }), _jsx("span", { className: `detail-state ${detailsLoading ? "is-live" : ""}`, children: detailsLoading ? "Fetching..." : trackDetails ? "Ready" : "Waiting" })] }), detailsError ? _jsx("p", { className: "detail-error", children: detailsError }) : null, trackDetails ? (_jsxs(_Fragment, { children: [_jsx(TrackSummary, { track: trackDetails.track, details: trackDetails.details }), typeof trackDetails.details.description === "string" &&
                                        trackDetails.details.description.trim() ? (_jsxs("div", { className: "detail-block", children: [_jsx("h3", { children: "Description" }), _jsx("p", { children: trackDetails.details.description })] })) : null, _jsxs("div", { className: "detail-block", children: [_jsx("h3", { children: "Full server payload" }), _jsx("pre", { children: JSON.stringify(trackDetails.details, null, 2) })] })] })) : null] })) : null, _jsxs("div", { className: "grid-row", children: [_jsxs("label", { className: "field", children: [_jsx("span", { children: "Format" }), _jsxs("select", { onChange: (event) => setFormat(event.target.value), value: format, children: [_jsx("option", { value: "mp3", children: "MP3" }), _jsx("option", { value: "aac", children: "AAC" }), _jsx("option", { value: "opus", children: "OPUS" }), _jsx("option", { value: "m4a", children: "M4A" }), _jsx("option", { value: "flac", children: "FLAC" }), _jsx("option", { value: "wav", children: "WAV" })] })] }), _jsxs("label", { className: "field", children: [_jsx("span", { children: "Quality" }), isLossless ? (_jsx("div", { className: "lossless-pill", children: "Lossless, no extra quality setting" })) : (_jsx("select", { onChange: (event) => setQuality(event.target.value), value: quality, children: qualityOptions.map((option) => (_jsx("option", { value: option.value, children: option.label }, option.value))) }))] })] }), _jsxs("p", { className: "note", children: ["Requires ", _jsx("code", { children: "yt-dlp" }), " and ", _jsx("code", { children: "ffmpeg" }), " in PATH. On Windows, install", _jsx("code", { children: " yt-dlp.exe" }), " and make sure both commands work in PowerShell."] }), _jsx("button", { className: "download-button", disabled: isBusy, onClick: () => void startDownload(), children: isBusy ? "DOWNLOADING" : "DOWNLOAD" }), _jsxs("div", { className: `status-panel ${statusType !== "idle" ? "visible" : ""} ${statusType}`, children: [_jsx("div", { className: "status-dot" }), _jsx("p", { children: statusMessage })] })] })] }));
}
function TrackSummary({ track, details }) {
    const artistProfile = typeof details.user?.permalink_url === "string" ? details.user.permalink_url : "";
    return (_jsxs("div", { className: "track-summary", children: [track.artworkUrl ? _jsx("img", { alt: track.title, className: "track-artwork", src: track.artworkUrl }) : null, _jsxs("div", { className: "track-summary-copy", children: [_jsx("h2", { children: track.title }), _jsx("p", { children: track.artist }), _jsxs("div", { className: "track-meta-grid", children: [_jsxs("span", { children: ["Duration: ", track.playbackLabel] }), _jsxs("span", { children: ["Quality: ", track.qualityHint] }), details.genre ? _jsxs("span", { children: ["Genre: ", details.genre] }) : null, typeof details.likes_count === "number" ? (_jsxs("span", { children: ["Likes: ", details.likes_count.toLocaleString()] })) : null, typeof details.playback_count === "number" ? (_jsxs("span", { children: ["Plays: ", details.playback_count.toLocaleString()] })) : null, typeof details.comment_count === "number" ? (_jsxs("span", { children: ["Comments: ", details.comment_count.toLocaleString()] })) : null] }), artistProfile ? (_jsx("a", { className: "track-link", href: artistProfile, rel: "noreferrer", target: "_blank", children: "Artist profile" })) : null] })] }));
}
