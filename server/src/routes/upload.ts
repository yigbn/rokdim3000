import { Router } from "express";
import multer from "multer";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { getDb } from "../db/schema.js";
import { requireAuth } from "../middleware/auth.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadsDir = path.join(__dirname, "../../uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const { userId } = (req as unknown as { auth: { userId: number } }).auth;
    const ext = path.extname(file.originalname) || ".jpg";
    cb(null, `user-${userId}-${Date.now()}${ext}`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = /^image\/(jpeg|png|gif|webp)$/i.test(file.mimetype);
    if (allowed) cb(null, true);
    else cb(new Error("רק קבצי תמונה (JPEG, PNG, GIF, WebP)"));
  },
});

const router = Router();
router.use(requireAuth);

router.post("/image", upload.single("image"), (req, res) => {
  if (!req.file) {
    res.status(400).json({ error: "לא נבחר קובץ תמונה" });
    return;
  }
  const { userId } = (req as unknown as { auth: { userId: number } }).auth;
  const db = getDb();
  const prev = db.prepare("SELECT image_path FROM users WHERE id = ?").get(userId) as { image_path: string | null } | undefined;
  if (prev?.image_path) {
    const oldPath = path.join(uploadsDir, prev.image_path);
    if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
  }
  const filename = path.basename(req.file.path);
  db.prepare("UPDATE users SET image_path = ?, updated_at = ? WHERE id = ?").run(
    filename,
    Date.now(),
    userId
  );
  db.close();
  res.json({ imagePath: filename });
});

export default router;
