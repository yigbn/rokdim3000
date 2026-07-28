import type { Request, Response, NextFunction } from "express";
import { verifyToken } from "../auth.js";
import { ADMIN_EMAIL } from "./admin.js";

export type AdminTokenRequest = Request & { adminEmail?: string };

export function requireAdminToken(req: AdminTokenRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Admin token required" });
    return;
  }

  const auth = verifyToken(authHeader.slice(7));
  if (!auth || auth.email.toLowerCase() !== ADMIN_EMAIL.toLowerCase()) {
    res.status(401).json({ error: "Invalid admin token" });
    return;
  }

  req.adminEmail = auth.email.toLowerCase();
  next();
}
