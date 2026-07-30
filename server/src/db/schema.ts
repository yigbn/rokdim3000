import Database from "better-sqlite3";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = process.env.DB_PATH || path.join(__dirname, "../../data/rokdim300.db");

export function getDb(): Database.Database {
  return new Database(dbPath);
}

export function initDb(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      phone TEXT,
      free_text TEXT,
      image_path TEXT,
      reset_token TEXT,
      reset_token_expires INTEGER,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS dances (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      creator TEXT,
      year_of_creation INTEGER,
      category TEXT,
      difficulty_level TEXT,
      youtube_link TEXT,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS dance_opinions (
      user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      opinion_text TEXT NOT NULL DEFAULT '',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS user_dance_ratings (
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      dance_id INTEGER NOT NULL REFERENCES dances(id) ON DELETE CASCADE,
      knowledge INTEGER NOT NULL CHECK(knowledge >= 1 AND knowledge <= 5),
      enjoyment INTEGER NOT NULL CHECK(enjoyment >= 1 AND enjoyment <= 5),
      updated_at INTEGER NOT NULL,
      PRIMARY KEY (user_id, dance_id)
    );

    CREATE TABLE IF NOT EXISTS instructor_submissions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      circle_dances TEXT NOT NULL DEFAULT '',
      couple_dances TEXT NOT NULL DEFAULT '',
      notes TEXT NOT NULL DEFAULT '',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS instructor_dance_ratings (
      instructor_username TEXT NOT NULL,
      dance_id INTEGER NOT NULL REFERENCES dances(id) ON DELETE CASCADE,
      knowledge INTEGER NOT NULL CHECK(knowledge >= 1 AND knowledge <= 5),
      enjoyment INTEGER NOT NULL CHECK(enjoyment >= 1 AND enjoyment <= 5),
      updated_at INTEGER NOT NULL,
      PRIMARY KEY (instructor_username, dance_id)
    );

    CREATE TABLE IF NOT EXISTS instructor_logins (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL,
      logged_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS instructors (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
    CREATE INDEX IF NOT EXISTS idx_users_reset_token ON users(reset_token);
    CREATE INDEX IF NOT EXISTS idx_instructors_username ON instructors(username);
  `);
  migrateDancesTable(db);
  migrateInstructorAuth(db);
}

/** Add creator and year_of_creation to dances if missing (for existing DBs). */
export function migrateDancesTable(db: Database.Database): void {
  const cols = db.prepare("PRAGMA table_info(dances)").all() as Array<{ name: string }>;
  const names = new Set(cols.map((c) => c.name));
  if (!names.has("creator")) {
    db.exec("ALTER TABLE dances ADD COLUMN creator TEXT");
  }
  if (!names.has("year_of_creation")) {
    db.exec("ALTER TABLE dances ADD COLUMN year_of_creation INTEGER");
  }
}

function tableHasColumn(db: Database.Database, table: string, column: string): boolean {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
  return cols.some((c) => c.name === column);
}

/** Username-based instructor accounts and related tables. */
export function migrateInstructorAuth(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS instructors (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_instructors_username ON instructors(username);
  `);

  if (tableHasColumn(db, "instructor_submissions", "email") && !tableHasColumn(db, "instructor_submissions", "username")) {
    db.exec("ALTER TABLE instructor_submissions RENAME COLUMN email TO username");
  }

  if (tableHasColumn(db, "instructor_logins", "email") && !tableHasColumn(db, "instructor_logins", "username")) {
    db.exec("ALTER TABLE instructor_logins RENAME COLUMN email TO username");
  }

  if (
    tableHasColumn(db, "instructor_dance_ratings", "instructor_email") &&
    !tableHasColumn(db, "instructor_dance_ratings", "instructor_username")
  ) {
    db.exec("ALTER TABLE instructor_dance_ratings RENAME COLUMN instructor_email TO instructor_username");
  }

  if (tableHasColumn(db, "instructor_submissions", "username")) {
    db.exec("CREATE INDEX IF NOT EXISTS idx_instructor_submissions_username ON instructor_submissions(username)");
  }
  if (tableHasColumn(db, "instructor_logins", "username")) {
    db.exec("CREATE INDEX IF NOT EXISTS idx_instructor_logins_username ON instructor_logins(username)");
  }
}
