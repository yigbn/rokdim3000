import "dotenv/config";
import fs from "node:fs";
import https from "node:https";
import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import cors from "cors";
import { getDb, initDb } from "./db/schema.js";
import authRoutes from "./routes/auth.js";
import userRoutes from "./routes/users.js";
import uploadRoutes from "./routes/upload.js";
import danceRoutes from "./routes/dances.js";
import danceOpinionsRoutes from "./routes/danceOpinions.js";
import danceRatingsRoutes from "./routes/danceRatings.js";
import instructorRoutes from "./routes/instructors.js";
import adminRoutes from "./routes/admin.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadsDir = path.join(__dirname, "../uploads");
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const db = getDb();
initDb(db);
db.close();

const app = express();
const PORT = process.env.PORT || 3000;
const certDir = path.resolve(__dirname, "../../.certs");
const httpsKeyPath = process.env.HTTPS_KEY_PATH ?? path.join(certDir, "localhost-key.pem");
const httpsCertPath = process.env.HTTPS_CERT_PATH ?? path.join(certDir, "localhost-cert.pem");
const useHttps = process.env.HTTPS !== "false" && fs.existsSync(httpsKeyPath) && fs.existsSync(httpsCertPath);

if (process.env.HTTPS === "true" && !useHttps) {
  throw new Error("HTTPS=true requires HTTPS_KEY_PATH and HTTPS_CERT_PATH or generated local certificates.");
}

app.use(cors({ origin: process.env.CLIENT_ORIGIN || "https://localhost:5173", credentials: true }));
app.use(express.json());
app.use("/uploads", express.static(uploadsDir));

app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/upload", uploadRoutes);
app.use("/api/dances", danceRoutes);
app.use("/api/dance-opinions", danceOpinionsRoutes);
app.use("/api/dance-ratings", danceRatingsRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/instructors", instructorRoutes);

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

const server = useHttps
  ? https.createServer({ key: fs.readFileSync(httpsKeyPath), cert: fs.readFileSync(httpsCertPath) }, app)
  : app;

server.listen(PORT, () => {
  const protocol = useHttps ? "https" : "http";
  console.log(`Rokdim 300 server at ${protocol}://localhost:${PORT}`);
});
