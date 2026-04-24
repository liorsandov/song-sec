import React from "react";
import ReactDOM from "react-dom/client";
import { initAnalytics } from "./analytics";
import App from "./App";
import "./styles.css";

initAnalytics();

ReactDOM.createRoot(document.getElementById("root")!).render(
    <App />
);
