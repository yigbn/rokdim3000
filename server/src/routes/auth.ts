import { Router } from "express";
import bcrypt from "bcryptjs";
import { nanoid } from "nanoid";
import { getDb } from "../db/schema.js";
import { signToken } from "../auth.js";
import { sendResetPasswordEmail, isEmailConfigured } from "../mailer.js";

const router = Router();
const SALT_ROUNDS = 10;

router.post("/register", (req, res) => {
  const { email, password, phone } = req.body as { email?: string; password?: string; phone?: string };
  if (!email || !password) {
    res.status(400).json({ error: "נא להזין אימייל וסיסמה" });
    return;
  }
  const db = getDb();
  const existing = db.prepare("SELECT id FROM users WHERE email = ?").get(email.toLowerCase());
  if (existing) {
    res.status(409).json({ error: "כתובת האימייל כבר רשומה" });
    return;
  }
  const password_hash = bcrypt.hashSync(password, SALT_ROUNDS);
  const now = Date.now();
  try {
    const result = db.prepare(
      "INSERT INTO users (email, password_hash, phone, created_at, updated_at) VALUES (?, ?, ?, ?, ?)"
    ).run(email.toLowerCase(), password_hash, phone ?? null, now, now);
    const userId = result.lastInsertRowid as number;
    const token = signToken({ userId, email: email.toLowerCase() });
    res.status(201).json({ token, user: { id: userId, email: email.toLowerCase(), phone: phone ?? null } });
  } finally {
    db.close();
  }
});

router.post("/login", (req, res) => {
  const { email, password } = req.body as { email?: string; password?: string };
  if (!email || !password) {
    res.status(400).json({ error: "נא להזין אימייל וסיסמה" });
    return;
  }
  const db = getDb();
  const row = db.prepare("SELECT id, email, password_hash, phone FROM users WHERE email = ?").get(email.toLowerCase()) as
    | { id: number; email: string; password_hash: string; phone: string | null }
    | undefined;
  db.close();
  if (!row || !bcrypt.compareSync(password, row.password_hash)) {
    res.status(401).json({ error: "אימייל או סיסמה שגויים" });
    return;
  }
  const token = signToken({ userId: row.id, email: row.email });
  res.json({ token, user: { id: row.id, email: row.email, phone: row.phone } });
});

router.post("/forgot-password", async (req, res) => {
  const { email } = req.body as { email?: string };
  if (!email) {
    res.status(400).json({ error: "נא להזין אימייל" });
    return;
  }
  const db = getDb();
  const row = db.prepare("SELECT id FROM users WHERE email = ?").get(email.toLowerCase()) as { id: number } | undefined;
  if (!row) {
    db.close();
    res.json({ message: "אם הכתובת קיימת במערכת, נשלח אליה קישור לאיפוס" });
    return;
  }
  const reset_token = nanoid(32);
  const reset_token_expires = Date.now() + 60 * 60 * 1000; // 1 hour
  db.prepare("UPDATE users SET reset_token = ?, reset_token_expires = ? WHERE id = ?").run(
    reset_token,
    reset_token_expires,
    row.id
  );
  db.close();
  const baseUrl = process.env.APP_URL || "http://localhost:5173";
  const resetLink = `${baseUrl}/reset-password?token=${reset_token}`;
  const sent = await sendResetPasswordEmail(email.toLowerCase(), resetLink);
  const payload: { message: string; resetLink?: string } = {
    message: "אם הכתובת קיימת במערכת, נשלח אליה קישור לאיפוס",
  };
  if (!sent && !isEmailConfigured()) payload.resetLink = resetLink;
  res.json(payload);
});

router.post("/reset-password", (req, res) => {
  const { token, newPassword } = req.body as { token?: string; newPassword?: string };
  if (!token || !newPassword) {
    res.status(400).json({ error: "נא להזין קישור איפוס וסיסמה חדשה" });
    return;
  }
  const db = getDb();
  const row = db.prepare(
    "SELECT id FROM users WHERE reset_token = ? AND reset_token_expires > ?"
  ).get(token, Date.now()) as { id: number } | undefined;
  if (!row) {
    db.close();
    res.status(400).json({ error: "קישור איפוס לא תקף או שפג תוקפו" });
    return;
  }
  const password_hash = bcrypt.hashSync(newPassword, SALT_ROUNDS);
  db.prepare(
    "UPDATE users SET password_hash = ?, reset_token = NULL, reset_token_expires = NULL, updated_at = ? WHERE id = ?"
  ).run(password_hash, Date.now(), row.id);
  db.close();
  res.json({ message: "הסיסמה עודכנה בהצלחה" });
});

export default router;
