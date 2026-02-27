import { Router } from "express";
import { getDb } from "../db/schema.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();
router.use(requireAuth);

router.get("/me", (req, res) => {
  const { userId } = (req as unknown as { auth: { userId: number } }).auth;
  const db = getDb();
  const row = db.prepare(
    "SELECT id, email, phone, free_text, image_path, created_at, updated_at FROM users WHERE id = ?"
  ).get(userId) as
    | { id: number; email: string; phone: string | null; free_text: string | null; image_path: string | null; created_at: number; updated_at: number }
    | undefined;
  db.close();
  if (!row) {
    res.status(404).json({ error: "משתמש לא נמצא" });
    return;
  }
  res.json({
    id: row.id,
    email: row.email,
    phone: row.phone,
    freeText: row.free_text,
    imagePath: row.image_path,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });
});

router.put("/me", (req, res) => {
  const { userId } = (req as unknown as { auth: { userId: number } }).auth;
  const { phone, freeText } = req.body as { phone?: string; freeText?: string };
  const db = getDb();
  const now = Date.now();
  db.prepare(
    "UPDATE users SET phone = COALESCE(?, phone), free_text = COALESCE(?, free_text), updated_at = ? WHERE id = ?"
  ).run(phone !== undefined ? phone : null, freeText !== undefined ? freeText : null, now, userId);
  db.close();
  res.json({ message: "עודכן", updatedAt: now });
});

export default router;
