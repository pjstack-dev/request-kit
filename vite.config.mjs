import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";

export default defineConfig({
  optimizeDeps: {
    include: ["react", "react-dom/client"],
  },
  server: {
    host: "0.0.0.0",
    allowedHosts: ["terminal.local"],
    warmup: {
      clientFiles: ["./src/main.jsx"],
    },
  },
  plugins: [react()],
  build: {
    rollupOptions: {
      input: {
        popup: resolve(__dirname, "index.html"),
        options: resolve(__dirname, "options.html"),
        background: resolve(__dirname, "src/extension/background.js"),
      },
      output: {
        entryFileNames: (chunk) =>
          chunk.name === "background"
            ? "background.js"
            : "assets/[name]-[hash].js",
        chunkFileNames: "assets/[name]-[hash].js",
        assetFileNames: "assets/[name]-[hash][extname]",
      },
    },
  },
});
