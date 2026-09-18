// Server-side replacement for the old Firestore-backed data layer.
//
// Every function here is the local-JSON equivalent of the function of the
// same purpose that used to live in src/lib/firestore.ts and talk to
// Firestore directly from the browser. Route handlers under src/app/api/
// call these; the client-side src/lib/firestore.ts now just fetches those
// routes so every page/component keeps working unchanged.
//
// Dates are returned as LocalTimestamp instances (see src/lib/timestamp.ts)
// so `.toDate()` / `.toMillis()` calls sprinkled through the UI keep working
// exactly as they did with real Firestore Timestamps.

import { withDb, readDb, newId, type StoredCouple } from "./db";
import { LocalTimestamp as Timestamp } from "@/lib/timestamp";
import { hashPassword, verifyPassword } from "./session";

export class ApiError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

function generateCoupleCode(uid?: string): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  if (uid) {
    let code = "";
    for (let i = 0; i < uid.length && code.length < 3; i++) {
      code += chars[uid.charCodeAt(i) % chars.length];
    }
    while (code.length < 6) code += chars.charAt(Math.floor(Math.random() * chars.length));
    return code.slice(0, 6);
  }
  let code = "";
  for (let i = 0; i < 6; i++) code += chars.charAt(Math.floor(Math.random() * chars.length));
  return code;
}

function getTodayDateString(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// ---------------------------------------------------------------------------
// Profiles
// ---------------------------------------------------------------------------

function toProfile(u: {
  uid: string;
  name: string;
  gender: string;
  email: string;
  relationshipStartDateMs: number;
  coupleId: string | null;
  coupleCode: string;
  createdAtMs: number;
  onboarded: boolean;
}) {
  return {
    uid: u.uid,
    name: u.name,
    gender: u.gender,
    email: u.email,
    relationshipStartDate: Timestamp.fromMillis(u.relationshipStartDateMs),
    coupleId: u.coupleId,
    coupleCode: u.coupleCode,
    createdAt: Timestamp.fromMillis(u.createdAtMs),
    onboarded: u.onboarded,
  };
}

export function signup(input: {
  email: string;
  password: string;
  name: string;
  gender: string;
  relationshipStartDate: number; // ms epoch
}) {
  const email = input.email.trim().toLowerCase();
  if (!email || !input.password || input.password.length < 6) {
    throw new ApiError("Email and a password of at least 6 characters are required.");
  }

  return withDb((db) => {
    const existing = Object.values(db.users).find((u) => u.email.toLowerCase() === email);
    if (existing) throw new ApiError("An account with this email already exists.");

    const uid = newId();
    const { salt, hash } = hashPassword(input.password);
    const coupleCode = generateCoupleCode(uid);

    db.users[uid] = {
      uid,
      name: input.name,
      gender: input.gender,
      email,
      passwordSalt: salt,
      passwordHash: hash,
      relationshipStartDateMs: input.relationshipStartDate,
      coupleId: null,
      coupleCode,
      createdAtMs: Date.now(),
      onboarded: false,
    };
    db.coupleCodes[coupleCode.toUpperCase()] = { uid, createdAtMs: Date.now() };

    return { uid, email, profile: toProfile(db.users[uid]) };
  });
}

export function login(input: { email: string; password: string }) {
  const email = input.email.trim().toLowerCase();
  return readDb((db) => {
    const user = Object.values(db.users).find((u) => u.email.toLowerCase() === email);
    if (!user || !verifyPassword(input.password, user.passwordSalt, user.passwordHash)) {
      throw new ApiError("Invalid email or password.", 401);
    }
    return { uid: user.uid, email: user.email, profile: toProfile(user) };
  });
}

export function getUserProfile(uid: string) {
  return readDb((db) => {
    const user = db.users[uid];
    return user ? toProfile(user) : null;
  });
}

export function getPartnerProfile(coupleId: string, currentUid: string) {
  return readDb((db) => {
    const couple = db.couples[coupleId];
    if (!couple) return null;
    const partnerId = couple.memberIds.find((id) => id !== currentUid);
    if (!partnerId) return null;
    const partner = db.users[partnerId];
    return partner ? toProfile(partner) : null;
  });
}

export function updateUserProfile(
  uid: string,
  data: { name?: string; relationshipStartDate?: number; coupleId?: string | null; onboarded?: boolean }
) {
  return withDb((db) => {
    const user = db.users[uid];
    if (!user) throw new ApiError("User not found.", 404);
    if (data.name !== undefined) user.name = data.name;
    if (data.relationshipStartDate !== undefined) user.relationshipStartDateMs = data.relationshipStartDate;
    if (data.onboarded !== undefined) user.onboarded = data.onboarded;

    if (data.relationshipStartDate !== undefined && data.coupleId) {
      const couple = db.couples[data.coupleId];
      if (couple) couple.relationshipStartDateMs = data.relationshipStartDate;
    }
    return null;
  });
}

export function ensureCoupleCodeIndex(uid: string) {
  return withDb((db) => {
    const user = db.users[uid];
    if (!user) throw new ApiError("User not found.", 404);
    const code = user.coupleCode.toUpperCase();
    if (!db.coupleCodes[code]) {
      db.coupleCodes[code] = { uid, createdAtMs: Date.now() };
    }
    return null;
  });
}

// ---------------------------------------------------------------------------
// Couples
// ---------------------------------------------------------------------------

function toCouple(c: StoredCouple) {
  return {
    id: c.id,
    memberIds: c.memberIds,
    relationshipStartDate: Timestamp.fromMillis(c.relationshipStartDateMs),
    createdAt: Timestamp.fromMillis(c.createdAtMs),
    coupleSong: c.coupleSong ?? null,
  };
}

export function getCouple(coupleId: string) {
  return readDb((db) => {
    const couple = db.couples[coupleId];
    return couple ? toCouple(couple) : null;
  });
}

export function assertCoupleMember(coupleId: string, uid: string) {
  return readDb((db) => {
    const couple = db.couples[coupleId];
    if (!couple || !couple.memberIds.includes(uid)) {
      throw new ApiError("You are not a member of this couple room.", 403);
    }
  });
}

export function joinCouple(userId: string, partnerCodeRaw: string) {
  return withDb((db) => {
    const user = db.users[userId];
    if (!user) throw new ApiError("User not found.", 404);
    if (user.coupleId) throw new ApiError("You are already connected to a partner.");

    let code = partnerCodeRaw.toUpperCase().trim();
    if (code.startsWith("TF-")) code = code.substring(3);
    code = code.replace(/[- ]/g, "");

    const codeEntry = db.coupleCodes[code];
    if (!codeEntry) {
      throw new ApiError("Invalid code — ask your partner to open Create Room first, then share the code again.");
    }
    const partnerUid = codeEntry.uid;
    if (partnerUid === userId) throw new ApiError("You cannot join your own room.");

    const partner = db.users[partnerUid];
    if (!partner) throw new ApiError("Partner not found.", 404);
    if (partner.coupleId) throw new ApiError("This room is already full.");

    const startMs = Math.min(user.relationshipStartDateMs, partner.relationshipStartDateMs);
    const coupleId = newId();

    db.couples[coupleId] = {
      id: coupleId,
      memberIds: [userId, partnerUid],
      relationshipStartDateMs: startMs,
      createdAtMs: Date.now(),
      coupleSong: null,
    };
    user.coupleId = coupleId;
    partner.coupleId = coupleId;

    return coupleId;
  });
}

export function updateCoupleSong(
  coupleId: string,
  uid: string,
  song: { type: "spotify" | "youtube" | "custom"; url: string; title?: string; artist?: string } | null
) {
  return withDb((db) => {
    const couple = db.couples[coupleId];
    if (!couple || !couple.memberIds.includes(uid)) throw new ApiError("Not a member of this couple room.", 403);
    couple.coupleSong = song;
    return null;
  });
}

// ---------------------------------------------------------------------------
// Daily memories
// ---------------------------------------------------------------------------

export function createDailyMemory(input: {
  userId: string;
  coupleId: string;
  imageUrl: string;
  caption?: string;
  note?: string;
}) {
  return withDb((db) => {
    const today = getTodayDateString();
    const already = db.dailyMemories.some(
      (m) => m.coupleId === input.coupleId && m.userId === input.userId && m.uploadDate === today
    );
    if (already) throw new ApiError("You already uploaded today's memory.");

    const memory = {
      id: newId(),
      coupleId: input.coupleId,
      userId: input.userId,
      imageUrl: input.imageUrl,
      caption: input.caption || "",
      note: input.note || "",
      uploadDate: today,
      createdAtMs: Date.now(),
      reactions: {},
    };
    db.dailyMemories.push(memory);
    return {
      ...memory,
      createdAt: Timestamp.fromMillis(memory.createdAtMs),
    };
  });
}

export function getTodayMemory(userId: string, coupleId: string) {
  return readDb((db) => {
    const today = getTodayDateString();
    const memory = db.dailyMemories.find(
      (m) => m.coupleId === coupleId && m.userId === userId && m.uploadDate === today
    );
    return memory ? { ...memory, createdAt: Timestamp.fromMillis(memory.createdAtMs) } : null;
  });
}

export function getMemories(coupleId: string, limitCount?: number) {
  return readDb((db) => {
    const list = db.dailyMemories
      .filter((m) => m.coupleId === coupleId)
      .sort((a, b) => b.createdAtMs - a.createdAtMs)
      .map((m) => ({ ...m, createdAt: Timestamp.fromMillis(m.createdAtMs) }));
    return limitCount ? list.slice(0, limitCount) : list;
  });
}

export function getMemoriesPaginated(coupleId: string, limitCount: number, cursorMs: number | null) {
  return readDb((db) => {
    let list = db.dailyMemories
      .filter((m) => m.coupleId === coupleId)
      .sort((a, b) => b.createdAtMs - a.createdAtMs);
    if (cursorMs != null) {
      list = list.filter((m) => m.createdAtMs < cursorMs);
    }
    const page = list.slice(0, limitCount);
    const memories = page.map((m) => ({ ...m, createdAt: Timestamp.fromMillis(m.createdAtMs) }));
    const lastVisible = page.length > 0 ? page[page.length - 1].createdAtMs : null;
    return { memories, lastVisible };
  });
}

export function toggleMemoryReaction(memoryId: string, uid: string, reaction: string | null) {
  return withDb((db) => {
    const memory = db.dailyMemories.find((m) => m.id === memoryId);
    if (!memory) return null;
    const couple = db.couples[memory.coupleId];
    if (!couple || !couple.memberIds.includes(uid)) {
      throw new ApiError("Not a member of this couple room.", 403);
    }
    const reactions = memory.reactions || {};
    if (reaction) reactions[uid] = reaction;
    else delete reactions[uid];
    memory.reactions = reactions;
    return null;
  });
}

// ---------------------------------------------------------------------------
// Moods
// ---------------------------------------------------------------------------

export function updateMood(coupleId: string, uid: string, mood: string, cooldownMinutes = 30) {
  return withDb((db) => {
    const recent = db.moods
      .filter((m) => m.coupleId === coupleId && m.userId === uid)
      .sort((a, b) => b.createdAtMs - a.createdAtMs)[0];

    if (recent) {
      const cooldownMs = cooldownMinutes * 60 * 1000;
      const elapsed = Date.now() - recent.createdAtMs;
      if (elapsed < cooldownMs) {
        const minsRemaining = Math.ceil((cooldownMs - elapsed) / 60000);
        throw new ApiError(`You can update your mood again in ${minsRemaining} minutes.`);
      }
    }

    db.moods.push({ id: newId(), coupleId, userId: uid, mood, createdAtMs: Date.now() });
    return null;
  });
}

export function getMoods(coupleId: string, limitCount = 50) {
  return readDb((db) =>
    db.moods
      .filter((m) => m.coupleId === coupleId)
      .sort((a, b) => b.createdAtMs - a.createdAtMs)
      .slice(0, limitCount)
      .map((m) => ({ ...m, createdAt: Timestamp.fromMillis(m.createdAtMs) }))
  );
}

// ---------------------------------------------------------------------------
// Future messages (time-capsule vault)
// ---------------------------------------------------------------------------

export function saveFutureMessage(input: {
  coupleId: string;
  senderId: string;
  message: string;
  imageUrl: string | null;
  unlockAt: number;
}) {
  return withDb((db) => {
    db.futureMessages.push({
      id: newId(),
      coupleId: input.coupleId,
      senderId: input.senderId,
      message: input.message,
      imageUrl: input.imageUrl,
      unlockAtMs: input.unlockAt,
      createdAtMs: Date.now(),
      opened: false,
    });
    return null;
  });
}

export function getFutureMessages(coupleId: string) {
  return readDb((db) =>
    db.futureMessages
      .filter((m) => m.coupleId === coupleId)
      .sort((a, b) => a.unlockAtMs - b.unlockAtMs)
      .map((m) => ({
        id: m.id,
        coupleId: m.coupleId,
        senderId: m.senderId,
        message: m.message,
        imageUrl: m.imageUrl,
        unlockAt: Timestamp.fromMillis(m.unlockAtMs),
        createdAt: Timestamp.fromMillis(m.createdAtMs),
        opened: m.opened,
      }))
  );
}

export function markFutureMessageAsOpened(messageId: string, uid: string) {
  return withDb((db) => {
    const msg = db.futureMessages.find((m) => m.id === messageId);
    if (!msg) return null;
    const couple = db.couples[msg.coupleId];
    if (!couple || !couple.memberIds.includes(uid)) {
      throw new ApiError("Not a member of this couple room.", 403);
    }
    msg.opened = true;
    return null;
  });
}

export function getFutureMessageSecret(messageId: string, uid: string) {
  return readDb((db) => {
    const msg = db.futureMessages.find((m) => m.id === messageId);
    if (!msg) return null;
    const couple = db.couples[msg.coupleId];
    if (!couple || !couple.memberIds.includes(uid)) {
      throw new ApiError("Not a member of this couple room.", 403);
    }
    return { message: msg.message, imageUrl: msg.imageUrl };
  });
}

// ---------------------------------------------------------------------------
// Couple playlist
// ---------------------------------------------------------------------------

export function getPlaylist(coupleId: string) {
  return readDb((db) => {
    const playlist = db.couplePlaylists[coupleId];
    if (!playlist) return null;
    return {
      coupleId: playlist.coupleId,
      songs: playlist.songs.map((s) => ({ ...s, createdAt: Timestamp.fromMillis(s.createdAtMs) })),
    };
  });
}

export function addSongToPlaylist(
  coupleId: string,
  song: { title: string; url: string; platform: "spotify" | "youtube" | "ambience"; artist?: string; addedBy: string }
) {
  return withDb((db) => {
    const existing = db.couplePlaylists[coupleId] ?? { coupleId, songs: [] };
    if (existing.songs.some((s) => s.url === song.url)) {
      throw new ApiError("This song is already in the playlist!");
    }
    if (existing.songs.length >= 50) {
      throw new ApiError("Playlist has reached its limit of 50 songs.");
    }
    existing.songs.push({
      id: Math.random().toString(36).substring(2, 9),
      title: song.title,
      url: song.url,
      platform: song.platform,
      artist: song.artist,
      addedBy: song.addedBy,
      createdAtMs: Date.now(),
    });
    db.couplePlaylists[coupleId] = existing;
    return null;
  });
}

export function removeSongFromPlaylist(coupleId: string, songId: string) {
  return withDb((db) => {
    const existing = db.couplePlaylists[coupleId];
    if (!existing) return null;
    existing.songs = existing.songs.filter((s) => s.id !== songId);
    return null;
  });
}

export function reorderPlaylist(coupleId: string, songIds: string[]) {
  return withDb((db) => {
    const existing = db.couplePlaylists[coupleId];
    if (!existing) return null;
    const byId = new Map(existing.songs.map((s) => [s.id, s]));
    existing.songs = songIds.map((id) => byId.get(id)).filter((s): s is NonNullable<typeof s> => Boolean(s));
    return null;
  });
}
