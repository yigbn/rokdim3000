import { Router, type NextFunction, type Request, type Response } from "express";
import { signToken, verifyToken } from "../auth.js";
import { getDb } from "../db/schema.js";

const router = Router();
const INSTRUCTOR_EMAIL = process.env.INSTRUCTOR_EMAIL || "yben99@gmail.com";
const INSTRUCTOR_PASSWORD = process.env.INSTRUCTOR_PASSWORD || "sonus0feve";
const MAX_DANCES_PER_LIST = 300;

type InstructorSubmissionRow = {
  email: string;
  circle_dances: string;
  couple_dances: string;
  notes: string;
  updated_at: number;
};

type InstructorRequest = Request & { instructorEmail?: string };

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function countDanceLines(value: string): number {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean).length;
}

function requireInstructor(req: InstructorRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ error: "נדרשת כניסת מרקידים" });
    return;
  }

  const auth = verifyToken(authHeader.slice(7));
  if (!auth || normalizeEmail(auth.email) !== normalizeEmail(INSTRUCTOR_EMAIL)) {
    res.status(401).json({ error: "כניסת המרקיד אינה תקפה" });
    return;
  }

  req.instructorEmail = normalizeEmail(auth.email);
  next();
}

function mapSubmission(row: InstructorSubmissionRow | undefined) {
  return {
    circleDances: row?.circle_dances ?? "",
    coupleDances: row?.couple_dances ?? "",
    notes: row?.notes ?? "",
    updatedAt: row?.updated_at ?? null,
  };
}

router.post("/login", (req, res) => {
  const { email, password } = req.body as { email?: string; password?: string };
  if (!email || !password) {
    res.status(400).json({ error: "נא להזין אימייל וסיסמה" });
    return;
  }

  if (
    normalizeEmail(email) !== normalizeEmail(INSTRUCTOR_EMAIL) ||
    password !== INSTRUCTOR_PASSWORD
  ) {
    res.status(401).json({ error: "האימייל או הסיסמה אינם נכונים" });
    return;
  }

  const token = signToken({ userId: 0, email: normalizeEmail(email) });
  res.json({ token });
});

router.get("/submission", requireInstructor, (req: InstructorRequest, res) => {
  const db = getDb();
  const row = db
    .prepare(
      "SELECT email, circle_dances, couple_dances, notes, updated_at FROM instructor_submissions WHERE email = ?",
    )
    .get(req.instructorEmail) as InstructorSubmissionRow | undefined;
  db.close();

  res.json(mapSubmission(row));
});

router.put("/submission", requireInstructor, (req: InstructorRequest, res) => {
  const { circleDances, coupleDances, notes } = req.body as {
    circleDances?: string;
    coupleDances?: string;
    notes?: string;
  };

  const nextCircleDances = typeof circleDances === "string" ? circleDances : "";
  const nextCoupleDances = typeof coupleDances === "string" ? coupleDances : "";
  const nextNotes = typeof notes === "string" ? notes : "";

  if (
    countDanceLines(nextCircleDances) > MAX_DANCES_PER_LIST ||
    countDanceLines(nextCoupleDances) > MAX_DANCES_PER_LIST
  ) {
    res.status(400).json({ error: "אפשר להזין עד 300 ריקודי מעגל ועד 300 ריקודי זוגות" });
    return;
  }

  const db = getDb();
  const now = Date.now();
  db.prepare(
    "INSERT INTO instructor_submissions (email, circle_dances, couple_dances, notes, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(email) DO UPDATE SET circle_dances = excluded.circle_dances, couple_dances = excluded.couple_dances, notes = excluded.notes, updated_at = excluded.updated_at",
  ).run(
    req.instructorEmail,
    nextCircleDances,
    nextCoupleDances,
    nextNotes,
    now,
    now,
  );
  db.close();

  res.json({
    circleDances: nextCircleDances,
    coupleDances: nextCoupleDances,
    notes: nextNotes,
    updatedAt: now,
  });
});

export default router;
