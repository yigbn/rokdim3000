import type { Request } from "express";
import jwt from "jsonwebtoken";
import type { JwtPayload } from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "rokdim300-dev-secret-change-in-production";

export interface AuthPayload {
  userId: number;
  email: string;
}

export function signToken(payload: AuthPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "7d" });
}

export function verifyToken(token: string): AuthPayload | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload & AuthPayload;
    return { userId: decoded.userId, email: decoded.email };
  } catch {
    return null;
  }
}

export function getAuthFromRequest(req: Request): AuthPayload | null {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) return null;
  return verifyToken(authHeader.slice(7));
}
