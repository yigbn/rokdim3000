import { Router } from "express";
import { getDb } from "../db/schema.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();
router.use(requireAuth);

router.get("/", (req, res) => {
  const { userId } = (req as unknown as { auth: { userId: number } }).auth;
  const db = getDb();
  const rows = db.prepare(
    "SELECT dance_id, knowledge, enjoyment, updated_at FROM user_dance_ratings WHERE user_id = ?"
  ).all(userId) as Array<{ dance_id: number; knowledge: number; enjoyment: number; updated_at: number }>;
  db.close();
  const byDance: Record<number, { knowledge: number; enjoyment: number; updatedAt: number }> = {};
  for (const r of rows) byDance[r.dance_id] = { knowledge: r.knowledge, enjoyment: r.enjoyment, updatedAt: r.updated_at };
  res.json(byDance);
});

router.get("/:danceId", (req, res) => {
  const { userId } = (req as unknown as { auth: { userId: number } }).auth;
  const danceId = parseInt(req.params.danceId, 10);
  if (Number.isNaN(danceId)) {
    res.status(400).json({ error: "מזהה ריקוד לא תקף" });
    return;
  }
  const db = getDb();
  const row = db.prepare(
    "SELECT knowledge, enjoyment, updated_at FROM user_dance_ratings WHERE user_id = ? AND dance_id = ?"
  ).get(userId, danceId) as { knowledge: number; enjoyment: number; updated_at: number } | undefined;
  db.close();
  if (!row) {
    res.json({ knowledge: null, enjoyment: null, updatedAt: null });
    return;
  }
  res.json({ knowledge: row.knowledge, enjoyment: row.enjoyment, updatedAt: row.updated_at });
});

router.put("/:danceId", (req, res) => {
  const { userId } = (req as unknown as { auth: { userId: number } }).auth;
  const danceId = parseInt(req.params.danceId, 10);
  if (Number.isNaN(danceId)) {
    res.status(400).json({ error: "מזהה ריקוד לא תקף" });
    return;
  }
  const { knowledge, enjoyment } = req.body as { knowledge?: number; enjoyment?: number };
  const k = typeof knowledge === "number" && knowledge >= 1 && knowledge <= 5 ? knowledge : 3;
  const e = typeof enjoyment === "number" && enjoyment >= 1 && enjoyment <= 5 ? enjoyment : 3;
  const db = getDb();
  const now = Date.now();
  db.prepare(
    "INSERT INTO user_dance_ratings (user_id, dance_id, knowledge, enjoyment, updated_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT(user_id, dance_id) DO UPDATE SET knowledge = excluded.knowledge, enjoyment = excluded.enjoyment, updated_at = excluded.updated_at"
  ).run(userId, danceId, k, e, now);
  db.close();
  res.json({ danceId, knowledge: k, enjoyment: e, updatedAt: now });
});

export default router;
