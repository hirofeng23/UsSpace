// Local, dependency-free replacement for Firebase Authentication.
//
// Passwords are hashed with Node's built-in scrypt (no bcrypt/native
// bindings to install). Sessions are a signed cookie (HMAC-SHA256 over a
// {uid, exp} payload) — no external session store needed. The signing
// secret is generated once on first run and stored in data/.session-secret
// (see db.ts), so there is nothing to configure by hand.
//
// This is deliberately simple: good enough for a private, self-hosted app
// used by two people. It has not been security-audited — don't reuse this
// pattern for anything that needs to withstand real attacker scrutiny.

import crypto from "crypto";
import { cookies } from "next/headers";
import { getSessionSecret } from "./db";

const COOKIE_NAME = "tf_session";
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 90; // 90 days

export function hashPassword(password: string): { salt: string; hash: string } {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return { salt, hash };
}

export function verifyPassword(password: string, salt: string, expectedHash: string): boolean {
  const hash = crypto.scryptSync(password, salt, 64);
  const expected = Buffer.from(expectedHash, "hex");
  if (hash.length !== expected.length) return false;
  return crypto.timingSafeEqual(hash, expected);
}

function sign(payload: string): string {
  return crypto.createHmac("sha256", getSessionSecret()).update(payload).digest("base64url");
}

function encodeSession(uid: string): string {
  const payload = JSON.stringify({ uid, exp: Date.now() + SESSION_TTL_MS });
  const encoded = Buffer.from(payload, "utf8").toString("base64url");
  const signature = sign(encoded);
  return `${encoded}.${signature}`;
}

function decodeSession(token: string): { uid: string } | null {
  const [encoded, signature] = token.split(".");
  if (!encoded || !signature) return null;
  const expected = sign(encoded);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
    if (typeof payload.uid !== "string" || typeof payload.exp !== "number") return null;
    if (Date.now() > payload.exp) return null;
    return { uid: payload.uid };
  } catch {
    return null;
  }
}

// Call from a Route Handler to log a user in (sets the cookie on the
// response via the Next.js cookies() store).
export async function createSession(uid: string): Promise<void> {
  const store = await cookies();
  store.set(COOKIE_NAME, encodeSession(uid), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: Math.floor(SESSION_TTL_MS / 1000),
  });
}

export async function destroySession(): Promise<void> {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}

// Returns the signed-in user's uid, or null if there is no valid session.
export async function getSessionUid(): Promise<string | null> {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (!token) return null;
  const session = decodeSession(token);
  return session?.uid ?? null;
}
