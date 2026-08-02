import { Router } from "express";
import bcrypt from "bcryptjs";
import { signToken } from "../auth.js";
import { ADMIN_EMAIL } from "../middleware/admin.js";
import { requireAdminToken } from "../middleware/adminToken.js";
import { getDb } from "../db/schema.js";

const router = Router();
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "sonus0feve";
const SALT_ROUNDS = 10;
const USERNAME_PATTERN = /^[a-z0-9_-]{3,32}$/;

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function normalizeUsername(username: string): string {
  return username.trim().toLowerCase();
}

function generateSimplePassword(): string {
  const parts = ["dance", "horaa", "rikud", "maagal", "zug", "step", "rim", "gal"];
  const pick = () => parts[Math.floor(Math.random() * parts.length)];
  const num = Math.floor(100 + Math.random() * 900);
  return `${pick()}${num}${pick()}`;
}

router.post("/login", (req, res) => {
  const { email, password } = req.body as { email?: string; password?: string };
  if (!email || !password) {
    res.status(400).json({ error: "Email and password required" });
    return;
  }

  if (normalizeEmail(email) !== ADMIN_EMAIL.toLowerCase() || password !== ADMIN_PASSWORD) {
    res.status(401).json({ error: "Invalid email or password" });
    return;
  }

  const token = signToken({ userId: 0, email: normalizeEmail(email) });
  res.json({ token });
});

router.post("/instructors", requireAdminToken, (req, res) => {
  const { username } = req.body as { username?: string };
  if (!username?.trim()) {
    res.status(400).json({ error: "Username required" });
    return;
  }

  const normalizedUsername = normalizeUsername(username);
  if (!USERNAME_PATTERN.test(normalizedUsername)) {
    res.status(400).json({
      error: "Username must be 3–32 characters: lowercase letters, digits, _ or -",
    });
    return;
  }

  const db = getDb();
  const existing = db
    .prepare("SELECT id FROM instructors WHERE username = ?")
    .get(normalizedUsername) as { id: number } | undefined;
  if (existing) {
    db.close();
    res.status(409).json({ error: "Username already taken" });
    return;
  }

  const plainPassword = generateSimplePassword();
  const passwordHash = bcrypt.hashSync(plainPassword, SALT_ROUNDS);
  const now = Date.now();
  db.prepare(
    "INSERT INTO instructors (username, password_hash, created_at, updated_at) VALUES (?, ?, ?, ?)",
  ).run(normalizedUsername, passwordHash, now, now);
  db.close();

  res.status(201).json({
    username: normalizedUsername,
    password: plainPassword,
    message: "Send these credentials to the instructor. The password is shown only once.",
  });
});

/** Admin only: set a new password when the instructor forgot the old one (old password cannot be retrieved). */
router.post("/instructors/:username/reset-password", requireAdminToken, (req, res) => {
  const raw = req.params.username;
  const username = normalizeUsername(Array.isArray(raw) ? raw[0] : raw);
  if (!username || !USERNAME_PATTERN.test(username)) {
    res.status(400).json({ error: "Invalid username" });
    return;
  }

  const db = getDb();
  const existing = db
    .prepare("SELECT id FROM instructors WHERE username = ?")
    .get(username) as { id: number } | undefined;
  if (!existing) {
    db.close();
    res.status(404).json({ error: "Instructor not found" });
    return;
  }

  const plainPassword = generateSimplePassword();
  const passwordHash = bcrypt.hashSync(plainPassword, SALT_ROUNDS);
  const now = Date.now();
  db.prepare("UPDATE instructors SET password_hash = ?, updated_at = ? WHERE username = ?").run(
    passwordHash,
    now,
    username,
  );
  db.close();

  res.json({
    username,
    password: plainPassword,
    message: "Password reset. Send the new password to the instructor; the old one no longer works.",
  });
});

export default router;
