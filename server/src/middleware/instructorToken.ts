import type { Request, Response, NextFunction } from "express";
import { verifyToken } from "../auth.js";
import { ADMIN_EMAIL } from "./admin.js";
import { getDb } from "../db/schema.js";

export type InstructorTokenRequest = Request & { instructorUsername?: string };

export function requireInstructorToken(
  req: InstructorTokenRequest,
  res: Response,
  next: NextFunction,
): void {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ error: "נדרשת כניסת מרקיד" });
    return;
  }

  const auth = verifyToken(authHeader.slice(7));
  if (!auth || auth.userId <= 0 || auth.email.includes("@")) {
    res.status(401).json({ error: "כניסת המרקיד אינה תקפה" });
    return;
  }

  const db = getDb();
  const row = db
    .prepare("SELECT username FROM instructors WHERE id = ? AND username = ?")
    .get(auth.userId, auth.email) as { username: string } | undefined;
  db.close();

  if (!row) {
    res.status(401).json({ error: "כניסת המרקיד אינה תקפה" });
    return;
  }

  req.instructorUsername = row.username;
  next();
}

/** Admin JWT uses userId 0 and the admin email — never treat as instructor. */
export function isAdminJwt(auth: { userId: number; email: string }): boolean {
  return auth.userId === 0 && auth.email.toLowerCase() === ADMIN_EMAIL.toLowerCase();
}
