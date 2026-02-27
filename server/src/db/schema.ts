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

    CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
    CREATE INDEX IF NOT EXISTS idx_users_reset_token ON users(reset_token);
  `);
}
