import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from "react";
const LOSSLESS_FORMATS = new Set(["flac", "wav"]);
const MP3_BITRATES = ["128k", "192k", "256k", "320k"];
const qualityOptions = [
    { value: "0", label: "Best, around 245 kbps" },
    { value: "2", label: "High, around 190 kbps" },
    { value: "5", label: "Medium, around 130 kbps" },
    { value: "7", label: "Low, around 100 kbps" },
    { value: "9", label: "Worst, around 65 kbps" }
];
const mp3BitrateOptions = [
    { value: "320k", label: "320 kbps (best)" },
    { value: "256k", label: "256 kbps" },
    { value: "192k", label: "192 kbps" },
    { value: "128k", label: "128 kbps" }
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
    const [quality, setQuality] = useState("320k");
    const [statusType, setStatusType] = useState("idle");
    const [statusMessage, setStatusMessage] = useState("Paste a SoundCloud track URL, choose a format, and download it.");
    const isLossless = LOSSLESS_FORMATS.has(format);
    const isMp3 = format === "mp3";
    const isBusy = statusType === "downloading";
    const trimmedUrl = url.trim();
    const looksLikeSoundCloudUrl = trimmedUrl.includes("soundcloud.com") || trimmedUrl.includes("snd.sc");
    // Reset quality when format changes
    useEffect(() => {
        if (isMp3) {
            setQuality("320k");
        }
        else {
            setQuality("0");
        }
    }, [isMp3]);
    const setStatus = (type, message) => {
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
    return (_jsxs("main", { className: "page-shell", children: [_jsx("div", { className: "noise-layer" }), _jsxs("section", { className: "hero", children: [_jsx("p", { className: "eyebrow", children: "Local downloader" }), _jsxs("h1", { children: ["SND", _jsx("span", { children: "CLD" })] }), _jsx("p", { className: "hero-copy", children: "Simple SoundCloud downloading, powered by yt-dlp. Works locally or in the cloud." })] }), _jsxs("section", { className: "card", children: [_jsxs("label", { className: "field", children: [_jsx("span", { children: "Track URL" }), _jsx("input", { autoComplete: "off", onChange: (event) => setUrl(event.target.value), onKeyDown: (event) => {
                                    if (event.key === "Enter" && !isBusy) {
                                        void startDownload();
                                    }
                                }, placeholder: "https://soundcloud.com/artist/track", spellCheck: false, type: "text", value: url })] }), _jsxs("div", { className: "grid-row", children: [_jsxs("label", { className: "field", children: [_jsx("span", { children: "Format" }), _jsxs("select", { onChange: (event) => setFormat(event.target.value), value: format, children: [_jsx("option", { value: "mp3", children: "MP3" }), _jsx("option", { value: "aac", children: "AAC" }), _jsx("option", { value: "opus", children: "OPUS" }), _jsx("option", { value: "m4a", children: "M4A" }), _jsx("option", { value: "flac", children: "FLAC" }), _jsx("option", { value: "wav", children: "WAV" })] })] }), _jsxs("label", { className: "field", children: [_jsx("span", { children: isMp3 ? "Bitrate" : "Quality" }), isLossless ? (_jsx("div", { className: "lossless-pill", children: "Lossless, no extra quality setting" })) : isMp3 ? (_jsx("select", { onChange: (event) => setQuality(event.target.value), value: quality, children: mp3BitrateOptions.map((option) => (_jsx("option", { value: option.value, children: option.label }, option.value))) })) : (_jsx("select", { onChange: (event) => setQuality(event.target.value), value: quality, children: qualityOptions.map((option) => (_jsx("option", { value: option.value, children: option.label }, option.value))) }))] })] }), _jsxs("p", { className: "note", children: ["Requires ", _jsx("code", { children: "yt-dlp" }), " and ", _jsx("code", { children: "ffmpeg" }), " available in PATH (install via Homebrew on macOS or your system package manager)."] }), _jsx("button", { className: "download-button", disabled: isBusy, onClick: () => void startDownload(), children: isBusy ? "DOWNLOADING" : "DOWNLOAD" }), _jsxs("div", { className: `status-panel ${statusType !== "idle" ? "visible" : ""} ${statusType}`, children: [_jsx("div", { className: "status-dot" }), _jsx("p", { children: statusMessage })] })] })] }));
}
