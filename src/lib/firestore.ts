// Client-side data layer for TwoFrames.
//
// This file used to call the Firestore SDK directly from the browser. It now
// talks to the local Next.js API routes under src/app/api/ instead (backed
// by a JSON file on disk — see src/lib/server/store.ts) — but every function
// below keeps its original name and signature, so every page/component that
// imports from "@/lib/firestore" needed zero changes.
//
// Firestore's real-time onSnapshot listeners have no local equivalent, so
// the subscribeTo* functions poll the API every few seconds instead. That's
// plenty responsive for two people checking in on each other.

import { reviveTimestamps } from "./timestamp";
import { uploadToCloudinary } from "./cloudinary";
import type {
  UserProfile,
  Couple,
  CoupleSong,
  DailyMemory,
  MoodEntry,
  MoodType,
  FutureMessage,
  CouplePlaylist,
  PlaylistItem,
} from "@/types";

export type Unsubscribe = () => void;

// A pagination cursor: the createdAt (ms) of the last item on the previous
// page, or null for the first page. Replaces Firestore's DocumentSnapshot.
export type MemoriesCursor = number | null;

async function call<T>(action: string, payload: Record<string, unknown> = {}): Promise<T> {
  const res = await fetch("/api/data", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, payload }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.message || "Request failed.");
  }
  return reviveTimestamps(data) as T;
}

function poll<T>(
  action: string,
  payload: Record<string, unknown>,
  callback: (data: T) => void,
  intervalMs = 4000
): Unsubscribe {
  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const tick = async () => {
    try {
      const data = await call<T>(action, payload);
      if (!stopped) callback(data);
    } catch (err) {
      console.warn(`[firestore] poll("${action}") failed:`, err);
    } finally {
      if (!stopped) timer = setTimeout(tick, intervalMs);
    }
  };

  tick();

  return () => {
    stopped = true;
    if (timer) clearTimeout(timer);
  };
}

// ---------------------------------------------------------------------------
// Profiles & couples
// ---------------------------------------------------------------------------

export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  return call<UserProfile | null>("getUserProfile", { uid });
}

export async function getPartnerProfile(coupleId: string, currentUid: string): Promise<UserProfile | null> {
  return call<UserProfile | null>("getPartnerProfile", { coupleId, currentUid });
}

export async function updateUserProfile(
  uid: string,
  data: { name?: string; relationshipStartDate?: Date; coupleId?: string | null; onboarded?: boolean }
): Promise<void> {
  await call("updateUserProfile", {
    uid,
    data: {
      ...data,
      relationshipStartDate: data.relationshipStartDate ? data.relationshipStartDate.getTime() : undefined,
    },
  });
}

export async function ensureCoupleCodeIndex(_profile: UserProfile): Promise<void> {
  await call("ensureCoupleCodeIndex", {});
}

export async function getCouple(coupleId: string): Promise<Couple | null> {
  return call<Couple | null>("getCouple", { coupleId });
}

export async function joinCouple(userId: string, partnerCode: string): Promise<string> {
  const result = await call<{ coupleId: string }>("joinCouple", { userId, partnerCode });
  return result.coupleId;
}

export async function updateCoupleSong(coupleId: string, song: CoupleSong | null): Promise<void> {
  await call("updateCoupleSong", { coupleId, song });
}

export function subscribeToCouple(coupleId: string, callback: (couple: Couple | null) => void): Unsubscribe {
  return poll<Couple | null>("getCouple", { coupleId }, callback);
}

// ---------------------------------------------------------------------------
// Daily memories
// ---------------------------------------------------------------------------

export async function uploadDailyMemory(
  userId: string,
  coupleId: string,
  file: File,
  caption?: string,
  note?: string,
  signal?: AbortSignal
): Promise<DailyMemory> {
  const imageUrl = await uploadToCloudinary(file, signal);
  return call<DailyMemory>("createDailyMemory", { coupleId, imageUrl, caption, note });
}

export async function getTodayMemory(userId: string, coupleId: string): Promise<DailyMemory | null> {
  return call<DailyMemory | null>("getTodayMemory", { coupleId });
}

export function subscribeToMemories(
  coupleId: string,
  callback: (memories: DailyMemory[]) => void,
  limitCount?: number
): Unsubscribe {
  return poll<DailyMemory[]>("getMemories", { coupleId, limitCount }, callback);
}

export async function getMemoriesPaginated(
  coupleId: string,
  limitCount: number,
  cursor?: MemoriesCursor
): Promise<{ memories: DailyMemory[]; lastVisible: MemoriesCursor }> {
  return call("getMemoriesPaginated", { coupleId, limitCount, cursorMs: cursor ?? null });
}

export async function toggleMemoryReaction(
  memoryId: string,
  userId: string,
  reaction: string | null
): Promise<void> {
  await call("toggleMemoryReaction", { memoryId, reaction });
}

// ---------------------------------------------------------------------------
// Moods
// ---------------------------------------------------------------------------

export async function updateMood(
  userId: string,
  coupleId: string,
  mood: MoodType,
  cooldownMinutes = 30
): Promise<void> {
  await call("updateMood", { coupleId, mood, cooldownMinutes });
}

export async function getLatestMood(userId: string, coupleId: string): Promise<MoodEntry | null> {
  const moods = await call<MoodEntry[]>("getMoods", { coupleId, limitCount: 50 });
  return moods.find((m) => m.userId === userId) ?? null;
}

export function subscribeToMoods(
  coupleId: string,
  callback: (moods: MoodEntry[]) => void,
  limitCount = 50
): Unsubscribe {
  return poll<MoodEntry[]>("getMoods", { coupleId, limitCount }, callback);
}

// ---------------------------------------------------------------------------
// Future messages (time-capsule vault)
// ---------------------------------------------------------------------------

export async function saveFutureMessage(
  coupleId: string,
  senderId: string,
  message: string,
  imageUrl: string | null,
  unlockAt: Date
): Promise<void> {
  await call("saveFutureMessage", { coupleId, message, imageUrl, unlockAt: unlockAt.getTime() });
}

export function subscribeToFutureMessages(
  coupleId: string,
  callback: (messages: FutureMessage[]) => void
): Unsubscribe {
  return poll<FutureMessage[]>("getFutureMessages", { coupleId }, callback);
}

export async function markFutureMessageAsOpened(messageId: string): Promise<void> {
  await call("markFutureMessageAsOpened", { messageId });
}

export async function getFutureMessageSecret(
  messageId: string
): Promise<{ message: string; imageUrl: string | null } | null> {
  return call("getFutureMessageSecret", { messageId });
}

// ---------------------------------------------------------------------------
// Couple playlist
// ---------------------------------------------------------------------------

export function subscribeToPlaylist(
  coupleId: string,
  callback: (playlist: CouplePlaylist | null) => void
): Unsubscribe {
  return poll<CouplePlaylist | null>("getPlaylist", { coupleId }, callback);
}

export async function addSongToPlaylist(
  coupleId: string,
  song: Omit<PlaylistItem, "id" | "createdAt">
): Promise<void> {
  await call("addSongToPlaylist", { coupleId, song });
}

export async function removeSongFromPlaylist(coupleId: string, songId: string): Promise<void> {
  await call("removeSongFromPlaylist", { coupleId, songId });
}

export async function reorderPlaylist(coupleId: string, songs: PlaylistItem[]): Promise<void> {
  await call("reorderPlaylist", { coupleId, songIds: songs.map((s) => s.id) });
}
