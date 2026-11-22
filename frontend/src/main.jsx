
import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";

import { registerSW } from "virtual:pwa-register";

import App from "./App";
import "./index.css";

// Register SplitMate PWA service worker
registerSW({
  immediate: true,

  onNeedRefresh() {
    console.log("SplitMate: A new update is available.");
  },

  onOfflineReady() {
    console.log("SplitMate: Offline app shell is ready.");
  },

  onRegisteredSW(swUrl, registration) {
    console.log(
      "SplitMate: Service worker registered.",
      swUrl
    );
  },

  onRegisterError(error) {
    console.error(
      "SplitMate: Service worker registration failed.",
      error
    );
  },
});

// Render SplitMate React application
ReactDOM.createRoot(
  document.getElementById("root")
).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
