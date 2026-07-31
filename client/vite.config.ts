import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const configDir = path.dirname(fileURLToPath(import.meta.url));
const certDir = path.resolve(configDir, "../.certs");

function getHttpsOptions() {
  return {
    key: fs.readFileSync(process.env.HTTPS_KEY_PATH ?? path.join(certDir, "localhost-key.pem")),
    cert: fs.readFileSync(process.env.HTTPS_CERT_PATH ?? path.join(certDir, "localhost-cert.pem")),
  };
}

export default defineConfig(({ command }) => ({
  plugins: [react()],
  server: {
    ...(command === "serve" ? { https: getHttpsOptions() } : {}),
    port: 5173,
    proxy: {
      "/api": { target: "https://localhost:3000", changeOrigin: true, secure: false },
      "/uploads": { target: "https://localhost:3000", changeOrigin: true, secure: false },
    },
  },
}));
