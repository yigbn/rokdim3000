import { Router } from "express";
import { signToken } from "../auth.js";
import { ADMIN_EMAIL } from "../middleware/admin.js";
import { getDb } from "../db/schema.js";

const router = Router();
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "sonus0feve";

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function recordInstructorLogin(email: string): void {
  const db = getDb();
  db.prepare("INSERT INTO instructor_logins (email, logged_at) VALUES (?, ?)").run(email, Date.now());
  db.close();
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

  const normalizedEmail = normalizeEmail(email);
  const token = signToken({ userId: 0, email: normalizedEmail });
  recordInstructorLogin(normalizedEmail);
  res.json({ token });
});

export default router;
