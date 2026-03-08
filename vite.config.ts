import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import { defineConfig } from "vitest/config";

export default defineConfig({
  base: "/WebPresenter/",
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["webpresenter-logo.svg"],
      manifest: {
        name: "WebPresenter",
        short_name: "WebPresenter",
        description: "Browser-first presentation and remote control app.",
        theme_color: "#071118",
        background_color: "#071118",
        display: "standalone",
        start_url: "/WebPresenter/#/remote",
        icons: [
          {
            src: "webpresenter-logo.svg",
            sizes: "192x192",
            type: "image/svg+xml",
          },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,png,ico}"],
      },
    }),
  ],
  test: {
    environment: "jsdom",
    setupFiles: "./src/test/setup.ts",
  },
});
