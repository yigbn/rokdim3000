import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDir, "../..");
const certDir = path.join(projectRoot, ".certs");
const keyPath = path.join(certDir, "localhost-key.pem");
const certPath = path.join(certDir, "localhost-cert.pem");

if (fs.existsSync(keyPath) && fs.existsSync(certPath)) {
  process.exit(0);
}

fs.mkdirSync(certDir, { recursive: true });

try {
  execFileSync(
    "openssl",
    [
      "req",
      "-x509",
      "-newkey",
      "rsa:2048",
      "-nodes",
      "-sha256",
      "-days",
      "365",
      "-subj",
      "/CN=localhost",
      "-addext",
      "subjectAltName=DNS:localhost,IP:127.0.0.1",
      "-keyout",
      keyPath,
      "-out",
      certPath,
    ],
    { stdio: "ignore" },
  );
  console.log(`Created local HTTPS certificates in ${certDir}`);
} catch (error) {
  fs.rmSync(keyPath, { force: true });
  fs.rmSync(certPath, { force: true });
  console.error("Could not create local HTTPS certificates. Install openssl or provide HTTPS_KEY_PATH and HTTPS_CERT_PATH.");
  process.exit(1);
}
