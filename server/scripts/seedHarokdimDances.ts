/**
 * One-time seed: load the 400 harokdim.org recommended dances as the initial basis.
 * Does not run at app startup — run manually once to set up the DB, then use the app
 * to edit / delete / add dances normally.
 *
 * Run once from repo root:  npm run db:seed-harokdim
 * Or from server dir:       npm run db:seed-harokdim
 *
 * Re-running will delete all current dances and insert the 400 again.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getDb, initDb, migrateDancesTable } from "../src/db/schema.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataPath = path.join(__dirname, "harokdim-dances.json");

const raw = fs.readFileSync(dataPath, "utf8");
const dances = JSON.parse(raw) as Array<{
  name: string;
  creator: string;
  type: string;
  yearOfCreation: number | null;
}>;

const db = getDb();
initDb(db);
migrateDancesTable(db);

db.prepare("DELETE FROM dances").run();
const now = Date.now();
const insert = db.prepare(
  `INSERT INTO dances (name, type, creator, year_of_creation, category, difficulty_level, youtube_link, created_at)
   VALUES (?, ?, ?, ?, NULL, NULL, NULL, ?)`
);

let inserted = 0;
for (const d of dances) {
  insert.run(
    d.name,
    d.type,
    d.creator || null,
    d.yearOfCreation ?? null,
    now
  );
  inserted++;
}

db.close();
console.log(`Done: removed existing dances, inserted ${inserted} dances from harokdim.org list.`);
