import type { Request, Response, NextFunction } from "express";
import { getAuthFromRequest } from "../auth.js";

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const auth = getAuthFromRequest(req);
  if (!auth) {
    res.status(401).json({ error: "נדרשת התחברות" });
    return;
  }
  (req as Request & { auth: { userId: number; email: string } }).auth = auth;
  next();
}
