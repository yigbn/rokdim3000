import { Router } from "express";
import bcrypt from "bcryptjs";
import { signToken } from "../auth.js";
import { ADMIN_EMAIL } from "../middleware/admin.js";
import { requireAdminToken, type AdminTokenRequest } from "../middleware/adminToken.js";
import { getDb } from "../db/schema.js";

const router = Router();
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "sonus0feve";
const SALT_ROUNDS = 10;
const USERNAME_PATTERN = /^[a-z0-9_-]{3,32}$/;
const INSTRUCTOR_CONTACT_STATUSES = ["unknown", "active", "course_graduate", "inactive"] as const;

type InstructorContactStatus = (typeof INSTRUCTOR_CONTACT_STATUSES)[number];

type InstructorContactRow = {
  id: number;
  full_name: string;
  phone: string;
  status: InstructorContactStatus;
  source: string;
  notes: string;
  created_by_admin_email: string | null;
  created_at: number;
  updated_at: number;
};

type InstructorContactInput = {
  fullName: string;
  phone: string;
  status: InstructorContactStatus;
  source: string;
  notes: string;
};

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

function cleanText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function parseInstructorContactStatus(value: unknown): InstructorContactStatus {
  return INSTRUCTOR_CONTACT_STATUSES.includes(value as InstructorContactStatus)
    ? (value as InstructorContactStatus)
    : "unknown";
}

function mapInstructorContact(row: InstructorContactRow) {
  return {
    id: row.id,
    fullName: row.full_name,
    phone: row.phone,
    status: row.status,
    source: row.source,
    notes: row.notes,
    createdByAdminEmail: row.created_by_admin_email,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function parseInstructorContactInput(value: unknown): { contact: InstructorContactInput } | { error: string } {
  const body = value as {
    fullName?: unknown;
    phone?: unknown;
    status?: unknown;
    source?: unknown;
    notes?: unknown;
  };

  const fullName = cleanText(body.fullName);
  const phone = cleanText(body.phone);
  const status = parseInstructorContactStatus(body.status);
  const source = cleanText(body.source);
  const notes = cleanText(body.notes);

  if (!fullName) return { error: "Full name required" };
  if (!phone) return { error: "Phone required" };
  if (fullName.length > 160) return { error: "Full name is too long" };
  if (phone.length > 40) return { error: "Phone is too long" };
  if (source.length > 500 || notes.length > 2000) return { error: "Source or notes are too long" };

  return { contact: { fullName, phone, status, source, notes } };
}

function insertInstructorContact(
  db: ReturnType<typeof getDb>,
  contact: InstructorContactInput,
  adminEmail: string | null,
): InstructorContactRow {
  const now = Date.now();
  const result = db
    .prepare(
      "INSERT INTO instructor_contacts (full_name, phone, status, source, notes, created_by_admin_email, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    )
    .run(contact.fullName, contact.phone, contact.status, contact.source, contact.notes, adminEmail, now, now);
  return db
    .prepare(
      "SELECT id, full_name, phone, status, source, notes, created_by_admin_email, created_at, updated_at FROM instructor_contacts WHERE id = ?",
    )
    .get(Number(result.lastInsertRowid)) as InstructorContactRow;
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

/** Admin only: list collected instructor contact leads. */
router.get("/instructor-contacts", requireAdminToken, (req, res) => {
  const q = cleanText(req.query.q);
  const rawLimit = Number(req.query.limit ?? 200);
  const limit = Number.isFinite(rawLimit) ? Math.min(Math.max(Math.trunc(rawLimit), 1), 500) : 200;

  const db = getDb();
  const rows = q
    ? (db
        .prepare(
          `SELECT id, full_name, phone, status, source, notes, created_by_admin_email, created_at, updated_at
           FROM instructor_contacts
           WHERE full_name LIKE ? OR phone LIKE ? OR source LIKE ? OR notes LIKE ?
           ORDER BY updated_at DESC, id DESC
           LIMIT ?`,
        )
        .all(`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`, limit) as InstructorContactRow[])
    : (db
        .prepare(
          `SELECT id, full_name, phone, status, source, notes, created_by_admin_email, created_at, updated_at
           FROM instructor_contacts
           ORDER BY updated_at DESC, id DESC
           LIMIT ?`,
        )
        .all(limit) as InstructorContactRow[]);
  db.close();

  res.json(rows.map(mapInstructorContact));
});

/** Admin only: get one collected instructor contact lead. */
router.get("/instructor-contacts/:id", requireAdminToken, (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({ error: "Invalid instructor contact id" });
    return;
  }

  const db = getDb();
  const row = db
    .prepare(
      "SELECT id, full_name, phone, status, source, notes, created_by_admin_email, created_at, updated_at FROM instructor_contacts WHERE id = ?",
    )
    .get(id) as InstructorContactRow | undefined;
  db.close();

  if (!row) {
    res.status(404).json({ error: "Instructor contact not found" });
    return;
  }

  res.json(mapInstructorContact(row));
});

/** Admin only: add a contact lead for an active instructor or instructor-course graduate. */
router.post("/instructor-contacts", requireAdminToken, (req: AdminTokenRequest, res) => {
  const parsed = parseInstructorContactInput(req.body);
  if ("error" in parsed) {
    res.status(400).json({ error: parsed.error });
    return;
  }

  const db = getDb();
  const row = insertInstructorContact(db, parsed.contact, req.adminEmail ?? null);
  db.close();

  res.status(201).json(mapInstructorContact(row));
});

/** Admin only: bulk import contact leads from a reviewed public-source list. */
router.post("/instructor-contacts/bulk", requireAdminToken, (req: AdminTokenRequest, res) => {
  const contacts = Array.isArray(req.body)
    ? req.body
    : Array.isArray((req.body as { contacts?: unknown }).contacts)
      ? (req.body as { contacts: unknown[] }).contacts
      : null;

  if (!contacts) {
    res.status(400).json({ error: "Expected an array or { contacts: [...] }" });
    return;
  }
  if (contacts.length === 0) {
    res.status(400).json({ error: "At least one contact is required" });
    return;
  }
  if (contacts.length > 500) {
    res.status(400).json({ error: "Bulk import supports up to 500 contacts" });
    return;
  }

  const parsedContacts: InstructorContactInput[] = [];
  for (const [index, contact] of contacts.entries()) {
    const parsed = parseInstructorContactInput(contact);
    if ("error" in parsed) {
      res.status(400).json({ error: `Contact ${index + 1}: ${parsed.error}` });
      return;
    }
    parsedContacts.push(parsed.contact);
  }

  const db = getDb();
  const insertAll = db.transaction((values: InstructorContactInput[]) =>
    values.map((contact) => insertInstructorContact(db, contact, req.adminEmail ?? null)),
  );
  const rows = insertAll(parsedContacts);
  db.close();

  res.status(201).json({ createdCount: rows.length, contacts: rows.map(mapInstructorContact) });
});

export default router;
