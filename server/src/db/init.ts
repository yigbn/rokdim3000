import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getDb, initDb } from "./schema.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, "../../data");
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db = getDb();
initDb(db);
console.log("Database initialized at", path.join(dataDir, "rokdim300.db"));
db.close();
