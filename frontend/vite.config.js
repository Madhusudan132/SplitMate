
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),

    VitePWA({
      registerType: "autoUpdate",

      includeAssets: [
        "favicon.ico",
        "favicon.svg",
        "apple-touch-icon.png",
      ],

      manifest: {
        id: "/",
        name: "SplitMate - Smart Bill Splitter",
        short_name: "SplitMate",

        description:
          "Scan restaurant bills, split expenses fairly, and track payments with SplitMate.",

        theme_color: "#FFD600",
        background_color: "#FFF9EC",

        display: "standalone",
        orientation: "portrait-primary",

        start_url: "/",
        scope: "/",

        icons: [
          {
            src: "/pwa-192x192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "/pwa-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "/pwa-maskable-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },

      workbox: {
        globPatterns: [
          "**/*.{js,css,html,ico,png,svg,woff2}",
        ],

        navigateFallback: "/index.html",

        navigateFallbackDenylist: [
          /^\/api(?:\/|$)/,
        ],

        runtimeCaching: [
          {
            urlPattern: ({ url }) =>
              url.pathname === "/api" ||
              url.pathname.startsWith("/api/"),

            handler: "NetworkOnly",
            method: "GET",
          },
        ],

        cleanupOutdatedCaches: true,
      },

      devOptions: {
        enabled: false,
      },
    }),
  ],
});
