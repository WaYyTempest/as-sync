import { defineConfig } from "wxt";

export default defineConfig({
  outDir: "output",
  manifest: {
    name: "AS Sync",
    description:
      "Backup and restore your anime-sama.tv progress across domain changes",
    version: "1.2.0",
    author: "WaYyTempest",
    homepage_url: "https://github.com/WaYyTempest/as-sync",
    permissions: ["storage", "activeTab"],
    browser_specific_settings: {
      gecko: {
        id: "as-sync@anime-sama.tv",
        strict_min_version: "142.0",
        data_collection_permissions: {
          required: ["none"],
          purposes: [],
          is_exempt: true,
        },
      },
    },
    web_accessible_resources: [
      {
        resources: ["injected.js"],
        matches: ["<all_urls>"],
      },
    ],
    icons: {
      16: "/icon-16.png",
      32: "/icon-32.png",
      48: "/icon-48.png",
      96: "/icon-96.png",
      128: "/icon-128.png",
    },
  },
});
