// @ts-nocheck
import { Request, Response, NextFunction } from "express";
// باقي محتوى الملف كما هو...
import type { NextFunction, Request, Response } from "express";
import { getAuth } from "@clerk/express";

export type AdminIdentity = { userId: string; email: string };
export type AdminRequest = Request & { admin?: AdminIdentity };

const cache = new Map<string, { email: string; expiresAt: number }>();

const getPrimaryEmail = async (userId: string): Promise<string | null> => {
  const cached = cache.get(userId);
  if (cached && cached.expiresAt > Date.now()) return cached.email;
  const secret = process.env.CLERK_SECRET_KEY;
  if (!secret) throw new Error("Clerk server configuration is unavailable");
  const response = await fetch(`https://api.clerk.com/v1/users/${encodeURIComponent(userId)}`, {
    headers: { Authorization: `Bearer ${secret}` },
    signal: AbortSignal.timeout(5_000),
  });
  if (!response.ok) return null;
  const user = await response.json() as {
    primary_email_address_id?: string;
    email_addresses?: Array<{ id: string; email_address: string }>;
  };
  const primary = user.email_addresses?.find((entry) => entry.id === user.primary_email_address_id)
    ?? user.email_addresses?.[0];
  if (!primary) return null;
  const email = primary.email_address.trim().toLowerCase();
  cache.set(userId, { email, expiresAt: Date.now() + 5 * 60_000 });
  return email;
};

export const requireCatalogAdmin = async (req: AdminRequest, res: Response, next: NextFunction): Promise<void> => {
  const auth = getAuth(req);
  const userId = auth.userId;
  if (!userId) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  try {
    const email = await getPrimaryEmail(userId);
    const allowed = new Set(
      (process.env.CATALOG_ADMIN_EMAILS ?? "")
        .split(",")
        .map((entry) => entry.trim().toLowerCase())
        .filter(Boolean),
    );
    if (!email || !allowed.has(email)) {
      res.status(403).json({ error: "Catalog administrator access required" });
      return;
    }
    req.admin = { userId, email };
    next();
  } catch (error) {
    req.log.error({ err: error, userId }, "Admin authorization check failed");
    res.status(503).json({ error: "Administrator verification is temporarily unavailable" });
  }
};

const rateWindows = new Map<string, { count: number; resetAt: number }>();
export const adminRateLimit = (req: AdminRequest, res: Response, next: NextFunction): void => {
  const key = req.admin?.userId ?? req.ip ?? "unknown";
  const now = Date.now();
  const window = rateWindows.get(key);
  if (!window || window.resetAt <= now) {
    rateWindows.set(key, { count: 1, resetAt: now + 60_000 });
    next();
    return;
  }
  window.count += 1;
  if (window.count > 180) {
    res.setHeader("Retry-After", Math.ceil((window.resetAt - now) / 1000));
    res.status(429).json({ error: "Too many admin requests" });
    return;
  }
  next();
};