import { Router } from "express";
import { getDb } from "../db/schema.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();
router.use(requireAuth);

router.get("/", (req, res) => {
  const { userId } = (req as unknown as { auth: { userId: number } }).auth;
  const db = getDb();
  const row = db.prepare("SELECT opinion_text, updated_at FROM dance_opinions WHERE user_id = ?").get(userId) as
    | { opinion_text: string; updated_at: number }
    | undefined;
  db.close();
  res.json({ opinionText: row?.opinion_text ?? "", updatedAt: row?.updated_at ?? null });
});

router.put("/", (req, res) => {
  const { userId } = (req as unknown as { auth: { userId: number } }).auth;
  const { opinionText } = req.body as { opinionText?: string };
  const text = typeof opinionText === "string" ? opinionText : "";
  const db = getDb();
  const now = Date.now();
  db.prepare(
    "INSERT INTO dance_opinions (user_id, opinion_text, created_at, updated_at) VALUES (?, ?, ?, ?) ON CONFLICT(user_id) DO UPDATE SET opinion_text = excluded.opinion_text, updated_at = excluded.updated_at"
  ).run(userId, text, now, now);
  db.close();
  res.json({ opinionText: text, updatedAt: now });
});

export default router;
