import { Router } from "express";
import bcrypt from "bcryptjs";
import multer from "multer";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { signToken } from "../auth.js";
import { getDb } from "../db/schema.js";
import { requireAdminToken } from "../middleware/adminToken.js";
import { requireInstructorToken, type InstructorTokenRequest } from "../middleware/instructorToken.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const instructorUploadsRoot = path.join(__dirname, "../../uploads/instructors");
if (!fs.existsSync(instructorUploadsRoot)) {
  fs.mkdirSync(instructorUploadsRoot, { recursive: true });
}

const router = Router();
const MAX_DANCES_PER_LIST = 300;
const MAX_FILE_SIZE_BYTES = 15 * 1024 * 1024;

type InstructorSubmissionRow = {
  username: string;
  circle_dances: string;
  couple_dances: string;
  notes: string;
  created_at: number;
  updated_at: number;
};

type InstructorListRow = {
  username: string;
  last_login_at: number | null;
  created_at: number | null;
  updated_at: number | null;
  circle_dances: string | null;
  couple_dances: string | null;
  notes: string | null;
  file_count: number;
};

type InstructorFileRow = {
  id: number;
  username: string;
  original_name: string;
  stored_path: string;
  mime_type: string | null;
  size_bytes: number;
  uploaded_at: number;
};

const instructorFileUpload = multer({
  storage: multer.diskStorage({
    destination: (req, _file, cb) => {
      const username = (req as InstructorTokenRequest).instructorUsername!;
      const dir = path.join(instructorUploadsRoot, username);
      fs.mkdirSync(dir, { recursive: true });
      cb(null, dir);
    },
    filename: (_req, file, cb) => {
      const safe = file.originalname.replace(/[^\w.\-()\u0590-\u05FF\s]/g, "_").slice(0, 120);
      cb(null, `${Date.now()}-${safe}`);
    },
  }),
  limits: { fileSize: MAX_FILE_SIZE_BYTES },
});

function mapInstructorFile(row: InstructorFileRow) {
  return {
    id: row.id,
    originalName: row.original_name,
    mimeType: row.mime_type,
    sizeBytes: row.size_bytes,
    uploadedAt: row.uploaded_at,
  };
}

function listInstructorFiles(username: string): ReturnType<typeof mapInstructorFile>[] {
  const db = getDb();
  const rows = db
    .prepare(
      "SELECT id, username, original_name, stored_path, mime_type, size_bytes, uploaded_at FROM instructor_files WHERE username = ? ORDER BY uploaded_at DESC",
    )
    .all(username) as InstructorFileRow[];
  db.close();
  return rows.map(mapInstructorFile);
}

function deleteInstructorFile(username: string, fileId: number): InstructorFileRow | null {
  const db = getDb();
  const row = db
    .prepare(
      "SELECT id, username, original_name, stored_path, mime_type, size_bytes, uploaded_at FROM instructor_files WHERE id = ? AND username = ?",
    )
    .get(fileId, username) as InstructorFileRow | undefined;
  if (!row) {
    db.close();
    return null;
  }

  db.prepare("DELETE FROM instructor_files WHERE id = ?").run(fileId);
  db.close();

  if (row.stored_path) {
    const resolved = path.resolve(row.stored_path);
    const uploadsRoot = path.resolve(instructorUploadsRoot);
    if (resolved.startsWith(`${uploadsRoot}${path.sep}`) && fs.existsSync(resolved)) {
      fs.unlinkSync(resolved);
    }
  }

  return row;
}

function normalizeUsername(username: string): string {
  return username.trim().toLowerCase();
}

function countDanceLines(value: string): number {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean).length;
}

function mapSubmission(row: InstructorSubmissionRow | undefined) {
  return {
    username: row?.username,
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
    username: row.username,
    lastLoginAt: row.last_login_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    hasSubmission: Boolean(circleDances.trim() || coupleDances.trim() || (row.notes ?? "").trim()),
    circleDanceCount: countDanceLines(circleDances),
    coupleDanceCount: countDanceLines(coupleDances),
    fileCount: row.file_count ?? 0,
  };
}

function getUsernameFromParam(value: string | string[] | undefined): string | null {
  const raw = Array.isArray(value) ? value[0] : value;
  if (!raw) return null;
  try {
    return normalizeUsername(decodeURIComponent(raw));
  } catch {
    return normalizeUsername(raw);
  }
}

function recordInstructorLogin(username: string): void {
  const db = getDb();
  db.prepare("INSERT INTO instructor_logins (username, logged_at) VALUES (?, ?)").run(username, Date.now());
  db.close();
}

router.post("/login", (req, res) => {
  const { username, password } = req.body as { username?: string; password?: string };
  if (!username || !password) {
    res.status(400).json({ error: "נא להזין שם משתמש וסיסמה" });
    return;
  }

  const normalizedUsername = normalizeUsername(username);
  const db = getDb();
  const row = db
    .prepare("SELECT id, username, password_hash FROM instructors WHERE username = ?")
    .get(normalizedUsername) as
    | { id: number; username: string; password_hash: string }
    | undefined;
  db.close();

  if (!row || !bcrypt.compareSync(password, row.password_hash)) {
    res.status(401).json({ error: "שם משתמש או סיסמה שגויים" });
    return;
  }

  recordInstructorLogin(row.username);
  const token = signToken({ userId: row.id, email: row.username });
  res.json({ token, username: row.username });
});

/** Admin only: all instructors who logged in and/or saved a submission. */
router.get("/", requireAdminToken, (_req, res) => {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT
         u.username,
         (SELECT MAX(logged_at) FROM instructor_logins WHERE username = u.username) AS last_login_at,
         s.created_at,
         s.updated_at,
         s.circle_dances,
         s.couple_dances,
         s.notes,
         (SELECT COUNT(*) FROM instructor_files f WHERE f.username = u.username) AS file_count
       FROM (
         SELECT username FROM instructors
         UNION
         SELECT username FROM instructor_logins
         UNION
         SELECT username FROM instructor_submissions
       ) u
       LEFT JOIN instructor_submissions s ON s.username = u.username
       ORDER BY COALESCE(s.updated_at, last_login_at, 0) DESC`,
    )
    .all() as InstructorListRow[];
  db.close();

  res.json(rows.map(mapInstructorSummary));
});

/** Admin only: uploaded files per instructor. */
router.get("/uploads", requireAdminToken, (_req, res) => {
  const db = getDb();
  const usernames = db
    .prepare(
      `SELECT DISTINCT username FROM (
         SELECT username FROM instructor_files
         UNION
         SELECT username FROM instructors
       ) ORDER BY username`,
    )
    .all() as { username: string }[];
  db.close();

  res.json(
    usernames.map(({ username }) => {
      const files = listInstructorFiles(username);
      return { username, fileCount: files.length, files };
    }),
  );
});

router.post("/files", requireInstructorToken, (req: InstructorTokenRequest, res) => {
  const instructorUsername = req.instructorUsername;
  if (!instructorUsername) {
    res.status(401).json({ error: "נדרשת כניסת מרקיד" });
    return;
  }

  instructorFileUpload.single("file")(req, res, (err) => {
    if (err instanceof multer.MulterError && err.code === "LIMIT_FILE_SIZE") {
      res.status(400).json({ error: "הקובץ גדול מדי (עד 15MB)" });
      return;
    }
    if (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : "שגיאה בהעלאת הקובץ" });
      return;
    }

    const uploaded = req.file;
    if (!uploaded) {
      res.status(400).json({ error: "לא נבחר קובץ" });
      return;
    }

    try {
      const db = getDb();
      const now = Date.now();
      const result = db
        .prepare(
          "INSERT INTO instructor_files (username, original_name, stored_path, mime_type, size_bytes, uploaded_at) VALUES (?, ?, ?, ?, ?, ?)",
        )
        .run(
          instructorUsername,
          uploaded.originalname,
          uploaded.path,
          uploaded.mimetype || null,
          uploaded.size,
          now,
        );
      const row = db
        .prepare(
          "SELECT id, username, original_name, stored_path, mime_type, size_bytes, uploaded_at FROM instructor_files WHERE id = ?",
        )
        .get(Number(result.lastInsertRowid)) as InstructorFileRow | undefined;
      db.close();

      if (!row) {
        res.status(500).json({ error: "הקובץ נשמר אך לא ניתן היה לאמת את השמירה" });
        return;
      }

      res.status(201).json(mapInstructorFile(row));
    } catch (e) {
      console.error("Instructor file upload failed:", e);
      if (uploaded.path && fs.existsSync(uploaded.path)) {
        fs.unlinkSync(uploaded.path);
      }
      res.status(500).json({ error: "שגיאה בשמירת הקובץ בשרת" });
    }
  });
});

router.get("/files", requireInstructorToken, (req: InstructorTokenRequest, res) => {
  res.json(listInstructorFiles(req.instructorUsername!));
});

router.get("/submission", requireInstructorToken, (req: InstructorTokenRequest, res) => {
  const db = getDb();
  const row = db
    .prepare(
      "SELECT username, circle_dances, couple_dances, notes, created_at, updated_at FROM instructor_submissions WHERE username = ?",
    )
    .get(req.instructorUsername) as InstructorSubmissionRow | undefined;
  db.close();

  res.json(mapSubmission(row));
});

router.put("/submission", requireInstructorToken, (req: InstructorTokenRequest, res) => {
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
    "INSERT INTO instructor_submissions (username, circle_dances, couple_dances, notes, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(username) DO UPDATE SET circle_dances = excluded.circle_dances, couple_dances = excluded.couple_dances, notes = excluded.notes, updated_at = excluded.updated_at",
  ).run(
    req.instructorUsername,
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

router.get("/ratings/:danceId", requireInstructorToken, (req: InstructorTokenRequest, res) => {
  const danceId = parseInt(String(req.params.danceId), 10);
  if (Number.isNaN(danceId)) {
    res.status(400).json({ error: "מזהה ריקוד לא תקף" });
    return;
  }

  const db = getDb();
  const row = db
    .prepare(
      "SELECT knowledge, enjoyment, updated_at FROM instructor_dance_ratings WHERE instructor_username = ? AND dance_id = ?",
    )
    .get(req.instructorUsername, danceId) as
    | { knowledge: number; enjoyment: number; updated_at: number }
    | undefined;
  db.close();

  if (!row) {
    res.json({ knowledge: null, enjoyment: null, updatedAt: null });
    return;
  }

  res.json({ knowledge: row.knowledge, enjoyment: row.enjoyment, updatedAt: row.updated_at });
});

router.put("/ratings/:danceId", requireInstructorToken, (req: InstructorTokenRequest, res) => {
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
    "INSERT INTO instructor_dance_ratings (instructor_username, dance_id, knowledge, enjoyment, updated_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT(instructor_username, dance_id) DO UPDATE SET knowledge = excluded.knowledge, enjoyment = excluded.enjoyment, updated_at = excluded.updated_at",
  ).run(req.instructorUsername, danceId, k, e, now);
  db.close();

  res.json({ danceId, knowledge: k, enjoyment: e, updatedAt: now });
});

/** Admin only: delete one uploaded file (DB row + file on disk). */
router.delete("/:username/files/:fileId", requireAdminToken, (req, res) => {
  const username = getUsernameFromParam(req.params.username);
  const fileId = parseInt(String(req.params.fileId), 10);
  if (!username) {
    res.status(400).json({ error: "נא להזין שם משתמש מרקיד" });
    return;
  }
  if (Number.isNaN(fileId) || fileId <= 0) {
    res.status(400).json({ error: "מזהה קובץ לא תקף" });
    return;
  }

  const deleted = deleteInstructorFile(username, fileId);
  if (!deleted) {
    res.status(404).json({ error: "קובץ לא נמצא" });
    return;
  }

  res.json({
    ok: true,
    username,
    deletedId: fileId,
    deletedFile: mapInstructorFile(deleted),
  });
});

/** Admin only: one instructor's notes and dance lists. */
router.get("/:username", requireAdminToken, (req, res) => {
  const username = getUsernameFromParam(req.params.username);
  if (!username) {
    res.status(400).json({ error: "נא להזין שם משתמש מרקיד" });
    return;
  }

  const db = getDb();
  const account = db
    .prepare("SELECT username, created_at FROM instructors WHERE username = ?")
    .get(username) as { username: string; created_at: number } | undefined;
  const submission = db
    .prepare(
      "SELECT username, circle_dances, couple_dances, notes, created_at, updated_at FROM instructor_submissions WHERE username = ?",
    )
    .get(username) as InstructorSubmissionRow | undefined;
  const lastLogin = db
    .prepare("SELECT MAX(logged_at) AS logged_at FROM instructor_logins WHERE username = ?")
    .get(username) as { logged_at: number | null } | undefined;
  const loginCount = db
    .prepare("SELECT COUNT(*) AS count FROM instructor_logins WHERE username = ?")
    .get(username) as { count: number };
  const fileCount = db
    .prepare("SELECT COUNT(*) AS count FROM instructor_files WHERE username = ?")
    .get(username) as { count: number };
  db.close();

  if (!account && !submission && !lastLogin?.logged_at) {
    res.status(404).json({ error: "מרקיד לא נמצא" });
    return;
  }

  res.json({
    ...mapSubmission(submission ?? {
      username,
      circle_dances: "",
      couple_dances: "",
      notes: "",
      created_at: account?.created_at ?? lastLogin?.logged_at ?? Date.now(),
      updated_at: account?.created_at ?? lastLogin?.logged_at ?? Date.now(),
    }),
    accountCreatedAt: account?.created_at ?? null,
    lastLoginAt: lastLogin?.logged_at ?? null,
    loginCount: loginCount.count,
    fileCount: fileCount.count,
    files: listInstructorFiles(username),
  });
});

export default router;
