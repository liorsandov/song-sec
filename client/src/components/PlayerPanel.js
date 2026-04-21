import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
export function PlayerPanel({ track }) {
    return (_jsxs("section", { className: "panel player-panel", children: [_jsxs("div", { className: "section-head", children: [_jsxs("div", { children: [_jsx("p", { className: "section-kicker", children: "Official Player" }), _jsx("h2", { children: track ? track.title : "Select a track" })] }), track ? _jsx("span", { className: "player-pill", children: track.artist }) : null] }), track?.embedUrl ? (_jsx("iframe", { allow: "autoplay", className: "player-frame", src: track.embedUrl, title: `SoundCloud embed for ${track.title}` })) : (_jsx("div", { className: "empty-state", children: "Choose a result or analyze a link to load the official SoundCloud embed." }))] }));
}
