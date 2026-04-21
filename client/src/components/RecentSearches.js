import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
export function RecentSearches({ items, onPick }) {
    return (_jsxs("section", { className: "panel panel-compact", children: [_jsx("div", { className: "section-head", children: _jsxs("div", { children: [_jsx("p", { className: "section-kicker", children: "Recent Searches" }), _jsx("h2", { children: "Jump back in" })] }) }), items.length ? (_jsx("div", { className: "chip-row", children: items.map((item) => (_jsx("button", { className: "chip", onClick: () => onPick(item), type: "button", children: item }, item))) })) : (_jsx("div", { className: "empty-mini", children: "Recent searches appear after your first query." }))] }));
}
