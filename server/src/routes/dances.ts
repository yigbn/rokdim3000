import { Router } from "express";
import { getDb } from "../db/schema.js";
import { requireAuth } from "../middleware/auth.js";
import { requireAdmin } from "../middleware/admin.js";

const router = Router();

function toDance(r: {
  id: number;
  name: string;
  type: string;
  creator: string | null;
  year_of_creation: number | null;
  category: string | null;
  difficulty_level: string | null;
  youtube_link: string | null;
  created_at: number;
}) {
  return {
    id: r.id,
    name: r.name,
    type: r.type,
    creator: r.creator,
    yearOfCreation: r.year_of_creation,
    category: r.category,
    difficultyLevel: r.difficulty_level,
    youtubeLink: r.youtube_link,
    createdAt: r.created_at,
  };
}

router.get("/", (_req, res) => {
  const db = getDb();
  const rows = db.prepare(
    "SELECT id, name, type, creator, year_of_creation, category, difficulty_level, youtube_link, created_at FROM dances ORDER BY name"
  ).all() as Array<{
    id: number;
    name: string;
    type: string;
    creator: string | null;
    year_of_creation: number | null;
    category: string | null;
    difficulty_level: string | null;
    youtube_link: string | null;
    created_at: number;
  }>;
  db.close();
  res.json(rows.map(toDance));
});

router.post("/", requireAuth, requireAdmin, (req, res) => {
  const { name, type, creator, yearOfCreation, category, difficultyLevel, youtubeLink } = req.body as {
    name?: string;
    type?: string;
    creator?: string;
    yearOfCreation?: number;
    category?: string;
    difficultyLevel?: string;
    youtubeLink?: string;
  };
  if (!name || !type) {
    res.status(400).json({ error: "נא להזין שם ריקוד וסוג (מעגל/זוגות)" });
    return;
  }
  const db = getDb();
  const now = Date.now();
  db.prepare(
    "INSERT INTO dances (name, type, creator, year_of_creation, category, difficulty_level, youtube_link, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
  ).run(name, type, creator ?? null, yearOfCreation ?? null, category ?? null, difficultyLevel ?? null, youtubeLink ?? null, now);
  const row = db.prepare(
    "SELECT id, name, type, creator, year_of_creation, category, difficulty_level, youtube_link, created_at FROM dances WHERE id = last_insert_rowid()"
  ).get() as {
    id: number;
    name: string;
    type: string;
    creator: string | null;
    year_of_creation: number | null;
    category: string | null;
    difficulty_level: string | null;
    youtube_link: string | null;
    created_at: number;
  };
  db.close();
  res.status(201).json(toDance(row));
});

router.put("/:id", requireAuth, requireAdmin, (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (Number.isNaN(id)) {
    res.status(400).json({ error: "מזהה לא תקף" });
    return;
  }
  const { name, type, creator, yearOfCreation, category, difficultyLevel, youtubeLink } = req.body as {
    name?: string;
    type?: string;
    creator?: string;
    yearOfCreation?: number;
    category?: string;
    difficultyLevel?: string;
    youtubeLink?: string;
  };
  const db = getDb();
  const existing = db.prepare(
    "SELECT id, name, type, creator, year_of_creation, category, difficulty_level, youtube_link, created_at FROM dances WHERE id = ?"
  ).get(id) as {
    id: number;
    name: string;
    type: string;
    creator: string | null;
    year_of_creation: number | null;
    category: string | null;
    difficulty_level: string | null;
    youtube_link: string | null;
    created_at: number;
  } | undefined;
  if (!existing) {
    db.close();
    res.status(404).json({ error: "ריקוד לא נמצא" });
    return;
  }
  const newName = name ?? existing.name;
  const newType = type ?? existing.type;
  const newCreator = creator !== undefined ? creator : existing.creator;
  const newYear = yearOfCreation !== undefined ? yearOfCreation : existing.year_of_creation;
  const newCategory = category !== undefined ? category : existing.category;
  const newDifficulty = difficultyLevel !== undefined ? difficultyLevel : existing.difficulty_level;
  const newYoutube = youtubeLink !== undefined ? youtubeLink : existing.youtube_link;
  db.prepare(
    "UPDATE dances SET name = ?, type = ?, creator = ?, year_of_creation = ?, category = ?, difficulty_level = ?, youtube_link = ? WHERE id = ?"
  ).run(newName, newType, newCreator, newYear, newCategory, newDifficulty, newYoutube, id);
  const row = db.prepare(
    "SELECT id, name, type, creator, year_of_creation, category, difficulty_level, youtube_link, created_at FROM dances WHERE id = ?"
  ).get(id) as {
    id: number;
    name: string;
    type: string;
    creator: string | null;
    year_of_creation: number | null;
    category: string | null;
    difficulty_level: string | null;
    youtube_link: string | null;
    created_at: number;
  };
  db.close();
  res.json(toDance(row));
});

export default router;
