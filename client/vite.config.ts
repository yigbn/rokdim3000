import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const configDir = path.dirname(fileURLToPath(import.meta.url));
const certDir = path.resolve(configDir, "../.certs");
const https = {
  key: fs.readFileSync(process.env.HTTPS_KEY_PATH ?? path.join(certDir, "localhost-key.pem")),
  cert: fs.readFileSync(process.env.HTTPS_CERT_PATH ?? path.join(certDir, "localhost-cert.pem")),
};

export default defineConfig({
  plugins: [react()],
  server: {
    https,
    port: 5173,
    proxy: {
      "/api": { target: "https://localhost:3000", changeOrigin: true, secure: false },
      "/uploads": { target: "https://localhost:3000", changeOrigin: true, secure: false },
    },
  },
});
