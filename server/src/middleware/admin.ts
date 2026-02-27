import type { Request, Response, NextFunction } from "express";

const ADMIN_EMAIL = "yben99@gmail.com";

export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  const auth = (req as Request & { auth?: { userId: number; email: string } }).auth;
  if (!auth || auth.email.toLowerCase() !== ADMIN_EMAIL.toLowerCase()) {
    res.status(403).json({ error: "אין הרשאה לביצוע פעולה זו" });
    return;
  }
  next();
}
