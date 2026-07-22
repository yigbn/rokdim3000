/**
 * Replace all dances with 8 demo dances (2 per type category).
 * Run from repo root: npm run db:seed-demo
 */
import { getDb, initDb, migrateDancesTable } from "../src/db/schema.js";

const DEMO_DANCES = [
  { name: "אור חדש (תהפוכות)", type: "circle", creator: "גדי ביטון", yearOfCreation: 2002 },
  { name: "אחיי בני תימן", type: "circle", creator: "ספי אביב", yearOfCreation: 1993 },
  { name: "אהבה אסורה (בנתיב מעורפל)", type: "couple", creator: "נפתלי קדוש", yearOfCreation: 1990 },
  { name: "אהובת לבבי", type: "couple", creator: "יאיר מנשה", yearOfCreation: 1989 },
  { name: "דרך ארץ השקד", type: "circles_btb", creator: "מאיר שם טוב", yearOfCreation: 1988 },
  { name: "מי האיש", type: "circles_btb", creator: "אליהו גמליאל", yearOfCreation: 1981 },
  { name: "אני אשתגע (פרידה קשה)", type: "couple_btb", creator: "אבי אמסלם", yearOfCreation: 1993 },
  { name: "בגללך", type: "couple_btb", creator: "גדי ביטון", yearOfCreation: 1995 },
] as const;

const db = getDb();
initDb(db);
migrateDancesTable(db);

db.prepare("DELETE FROM user_dance_ratings").run();
db.prepare("DELETE FROM instructor_dance_ratings").run();
db.prepare("DELETE FROM dances").run();

const now = Date.now();
const insert = db.prepare(
  `INSERT INTO dances (name, type, creator, year_of_creation, category, difficulty_level, youtube_link, created_at)
   VALUES (?, ?, ?, ?, NULL, NULL, NULL, ?)`,
);

for (const dance of DEMO_DANCES) {
  insert.run(dance.name, dance.type, dance.creator, dance.yearOfCreation, now);
}

db.close();
console.log(`Done: inserted ${DEMO_DANCES.length} demo dances (2 per category).`);
