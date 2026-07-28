import { Router } from "express";
import { getDb } from "../db/schema.js";
import { requireAdminToken, type AdminTokenRequest } from "../middleware/adminToken.js";

const router = Router();
const MAX_DANCES_PER_LIST = 300;

type InstructorSubmissionRow = {
  email: string;
  circle_dances: string;
  couple_dances: string;
  notes: string;
  created_at: number;
  updated_at: number;
};

type InstructorListRow = {
  email: string;
  last_login_at: number | null;
  created_at: number | null;
  updated_at: number | null;
  circle_dances: string | null;
  couple_dances: string | null;
  notes: string | null;
};

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function countDanceLines(value: string): number {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean).length;
}

function mapSubmission(row: InstructorSubmissionRow | undefined) {
  return {
    email: row?.email,
    circleDances: row?.circle_dances ?? "",
    coupleDances: row?.couple_dances ?? "",
    notes: row?.notes ?? "",
    createdAt: row?.created_at ?? null,
    updatedAt: row?.updated_at ?? null,
  };
}

function mapInstructorSummary(row: InstructorListRow) {
  const circleDances = row.circle_dances ?? "";
  const coupleDances = row.couple_dances ?? "";
  return {
    email: row.email,
    lastLoginAt: row.last_login_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    hasSubmission: Boolean(circleDances.trim() || coupleDances.trim() || (row.notes ?? "").trim()),
    circleDanceCount: countDanceLines(circleDances),
    coupleDanceCount: countDanceLines(coupleDances),
  };
}

function getInstructorEmailFromParam(value: string | string[] | undefined): string | null {
  const raw = Array.isArray(value) ? value[0] : value;
  if (!raw) return null;
  try {
    return normalizeEmail(decodeURIComponent(raw));
  } catch {
    return normalizeEmail(raw);
  }
}

router.use(requireAdminToken);

/** Admin only: all instructors who logged in and/or saved a submission. */
router.get("/", (_req, res) => {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT
         e.email,
         (SELECT MAX(logged_at) FROM instructor_logins WHERE email = e.email) AS last_login_at,
         s.created_at,
         s.updated_at,
         s.circle_dances,
         s.couple_dances,
         s.notes
       FROM (
         SELECT email FROM instructor_logins
         UNION
         SELECT email FROM instructor_submissions
       ) e
       LEFT JOIN instructor_submissions s ON s.email = e.email
       ORDER BY COALESCE(s.updated_at, last_login_at, 0) DESC`,
    )
    .all() as InstructorListRow[];
  db.close();

  res.json(rows.map(mapInstructorSummary));
});

router.get("/submission", (req: AdminTokenRequest, res) => {
  const db = getDb();
  const row = db
    .prepare(
      "SELECT email, circle_dances, couple_dances, notes, created_at, updated_at FROM instructor_submissions WHERE email = ?",
    )
    .get(req.adminEmail) as InstructorSubmissionRow | undefined;
  db.close();

  res.json(mapSubmission(row));
});

router.put("/submission", (req: AdminTokenRequest, res) => {
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
    req.adminEmail,
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

router.get("/ratings/:danceId", (req: AdminTokenRequest, res) => {
  const danceId = parseInt(String(req.params.danceId), 10);
  if (Number.isNaN(danceId)) {
    res.status(400).json({ error: "מזהה ריקוד לא תקף" });
    return;
  }

  const db = getDb();
  const row = db
    .prepare(
      "SELECT knowledge, enjoyment, updated_at FROM instructor_dance_ratings WHERE instructor_email = ? AND dance_id = ?",
    )
    .get(req.adminEmail, danceId) as
    | { knowledge: number; enjoyment: number; updated_at: number }
    | undefined;
  db.close();

  if (!row) {
    res.json({ knowledge: null, enjoyment: null, updatedAt: null });
    return;
  }

  res.json({ knowledge: row.knowledge, enjoyment: row.enjoyment, updatedAt: row.updated_at });
});

router.put("/ratings/:danceId", (req: AdminTokenRequest, res) => {
  const danceId = parseInt(String(req.params.danceId), 10);
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
    "INSERT INTO instructor_dance_ratings (instructor_email, dance_id, knowledge, enjoyment, updated_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT(instructor_email, dance_id) DO UPDATE SET knowledge = excluded.knowledge, enjoyment = excluded.enjoyment, updated_at = excluded.updated_at",
  ).run(req.adminEmail, danceId, k, e, now);
  db.close();

  res.json({ danceId, knowledge: k, enjoyment: e, updatedAt: now });
});

/** Admin only: one instructor's notes and dance lists. */
router.get("/:email", (req, res) => {
  const email = getInstructorEmailFromParam(req.params.email);
  if (!email) {
    res.status(400).json({ error: "נא להזין אימייל מרקיד" });
    return;
  }

  const db = getDb();
  const submission = db
    .prepare(
      "SELECT email, circle_dances, couple_dances, notes, created_at, updated_at FROM instructor_submissions WHERE email = ?",
    )
    .get(email) as InstructorSubmissionRow | undefined;
  const lastLogin = db
    .prepare("SELECT MAX(logged_at) AS logged_at FROM instructor_logins WHERE email = ?")
    .get(email) as { logged_at: number | null } | undefined;
  const loginCount = db
    .prepare("SELECT COUNT(*) AS count FROM instructor_logins WHERE email = ?")
    .get(email) as { count: number };
  db.close();

  if (!submission && !lastLogin?.logged_at) {
    res.status(404).json({ error: "מרקיד לא נמצא" });
    return;
  }

  res.json({
    ...mapSubmission(submission ?? {
      email,
      circle_dances: "",
      couple_dances: "",
      notes: "",
      created_at: lastLogin?.logged_at ?? Date.now(),
      updated_at: lastLogin?.logged_at ?? Date.now(),
    }),
    lastLoginAt: lastLogin?.logged_at ?? null,
    loginCount: loginCount.count,
  });
});

export default router;
