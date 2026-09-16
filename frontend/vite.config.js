import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    open: false,
    proxy: {
      "/api": {
        target: "http://localhost:8080",
        changeOrigin: true,
      },
      "/offer": {
        target: "http://localhost:8080",
        changeOrigin: true,
      },
      "/ws": {
        target: "ws://localhost:8080",
        ws: true,
      },
      "/export-certificate": {
        target: "http://localhost:8080",
        changeOrigin: true,
      },
      "/export-pdf": {
        target: "http://localhost:8080",
        changeOrigin: true,
      },
    },
  },
});
