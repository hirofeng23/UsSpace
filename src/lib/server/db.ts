// Zero-config local "database" for TwoFrames.
//
// Replaces Firestore with a single JSON file on disk (data/db.json) plus a
// local folder for uploaded photos/audio (public/uploads/). No external
// service, no account, no environment variables required — the file and
// folder are created automatically the first time the app runs.
//
// This is intentionally simple: TwoFrames is used by exactly two people, so
// a plain JSON file guarded by an in-process write queue is more than enough
// and far easier to reason about (and back up — it's one file) than a real
// database engine.

import fs from "fs";
import path from "path";
import crypto from "crypto";

export interface StoredUser {
  uid: string;
  name: string;
  gender: string;
  email: string;
  passwordHash: string;
  passwordSalt: string;
  relationshipStartDateMs: number;
  coupleId: string | null;
  coupleCode: string;
  createdAtMs: number;
  onboarded: boolean;
}

export interface StoredCouple {
  id: string;
  memberIds: string[];
  relationshipStartDateMs: number;
  createdAtMs: number;
  coupleSong?: { type: "spotify" | "youtube" | "custom"; url: string; title?: string; artist?: string } | null;
}

export interface StoredMemory {
  id: string;
  coupleId: string;
  userId: string;
  imageUrl: string;
  caption?: string;
  note?: string;
  uploadDate: string;
  createdAtMs: number;
  reactions?: Record<string, string>;
}

export interface StoredMood {
  id: string;
  coupleId: string;
  userId: string;
  mood: string;
  createdAtMs: number;
}

export interface StoredFutureMessage {
  id: string;
  coupleId: string;
  senderId: string;
  message: string;
  imageUrl: string | null;
  unlockAtMs: number;
  createdAtMs: number;
  opened: boolean;
}

export interface StoredPlaylistItem {
  id: string;
  title: string;
  url: string;
  platform: "spotify" | "youtube" | "ambience";
  artist?: string;
  addedBy: string;
  createdAtMs: number;
}

export interface DbShape {
  users: Record<string, StoredUser>;
  coupleCodes: Record<string, { uid: string; createdAtMs: number }>;
  couples: Record<string, StoredCouple>;
  dailyMemories: StoredMemory[];
  moods: StoredMood[];
  futureMessages: StoredFutureMessage[];
  couplePlaylists: Record<string, { coupleId: string; songs: StoredPlaylistItem[] }>;
}

const DATA_DIR = path.join(process.cwd(), "data");
const DB_FILE = path.join(DATA_DIR, "db.json");
const UPLOADS_DIR = path.join(process.cwd(), "public", "uploads");
const SECRET_FILE = path.join(DATA_DIR, ".session-secret");

function emptyDb(): DbShape {
  return {
    users: {},
    coupleCodes: {},
    couples: {},
    dailyMemories: [],
    moods: [],
    futureMessages: [],
    couplePlaylists: {},
  };
}

function ensureDirs() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

function loadFromDisk(): DbShape {
  ensureDirs();
  if (!fs.existsSync(DB_FILE)) {
    const fresh = emptyDb();
    fs.writeFileSync(DB_FILE, JSON.stringify(fresh, null, 2), "utf8");
    return fresh;
  }
  try {
    const raw = fs.readFileSync(DB_FILE, "utf8");
    const parsed = JSON.parse(raw) as Partial<DbShape>;
    // Merge onto a fresh shape so a hand-edited/older file never crashes the app.
    return { ...emptyDb(), ...parsed };
  } catch (err) {
    console.error("[db] Failed to read data/db.json, starting from an empty database:", err);
    return emptyDb();
  }
}

// Simple in-memory cache + serialized writes so concurrent requests never
// interleave and corrupt the JSON file.
let cache: DbShape | null = null;
let writeChain: Promise<void> = Promise.resolve();

function getDb(): DbShape {
  if (!cache) cache = loadFromDisk();
  return cache;
}

function persist() {
  const snapshot = JSON.stringify(cache, null, 2);
  writeChain = writeChain.then(
    () =>
      new Promise<void>((resolve, reject) => {
        fs.writeFile(DB_FILE, snapshot, "utf8", (err) => (err ? reject(err) : resolve()));
      })
  );
  // Surface write errors in the server log without crashing the request.
  writeChain.catch((err) => console.error("[db] Failed to write data/db.json:", err));
}

// Runs `fn` against the live database and persists afterwards. Callers
// mutate the object passed to `fn` directly (it's the live in-memory copy).
export function withDb<T>(fn: (db: DbShape) => T): T {
  const db = getDb();
  const result = fn(db);
  persist();
  return result;
}

export function readDb<T>(fn: (db: DbShape) => T): T {
  return fn(getDb());
}

export function newId(): string {
  return crypto.randomBytes(9).toString("base64url");
}

export function getUploadsDir(): string {
  ensureDirs();
  return UPLOADS_DIR;
}

// A random secret, generated once and reused across restarts, used to sign
// session cookies. Nothing to configure — it lives next to the database.
export function getSessionSecret(): string {
  ensureDirs();
  if (!fs.existsSync(SECRET_FILE)) {
    const secret = crypto.randomBytes(32).toString("hex");
    fs.writeFileSync(SECRET_FILE, secret, "utf8");
    return secret;
  }
  return fs.readFileSync(SECRET_FILE, "utf8").trim();
}
