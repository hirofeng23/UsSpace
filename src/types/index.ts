import { LocalTimestamp as Timestamp } from "@/lib/timestamp";

export type MoodType =
  | "happy"
  | "missing"
  | "sad"
  | "busy"
  | "excited"
  | "angry"
  | "sleepy"
  | "loved";

export interface UserProfile {
  uid: string;
  name: string;
  gender: string;
  email: string;
  relationshipStartDate: Timestamp;
  coupleId: string | null;
  coupleCode: string;
  createdAt: Timestamp;
  onboarded?: boolean;
}

export interface CoupleSong {
  type: "spotify" | "youtube" | "custom";
  url: string;
  title?: string;
  artist?: string;
}

export interface Couple {
  id: string;
  memberIds: string[];
  relationshipStartDate: Timestamp;
  createdAt: Timestamp;
  coupleSong?: CoupleSong | null;
}

export interface PlaylistItem {
  id: string;
  title: string;
  url: string;
  platform: "spotify" | "youtube" | "ambience";
  artist?: string;
  addedBy: string;
  createdAt: Timestamp;
}

export interface CouplePlaylist {
  coupleId: string;
  songs: PlaylistItem[];
}

export interface DailyMemory {
  id: string;
  coupleId: string;
  userId: string;
  imageUrl: string;
  caption?: string;
  note?: string;
  uploadDate: string;
  createdAt: Timestamp;
  reactions?: Record<string, string>;
}

export interface MoodEntry {
  id: string;
  coupleId: string;
  userId: string;
  mood: MoodType;
  createdAt: Timestamp;
}

export interface FutureMessage {
  id: string;
  coupleId: string;
  senderId: string;
  message: string;
  imageUrl: string | null;
  unlockAt: Timestamp;
  createdAt: Timestamp;
  opened: boolean;
}

export const MOOD_OPTIONS: {
  value: MoodType;
  label: string;
  emoji: string;
  color: string;
}[] = [
  { value: "happy", label: "Happy", emoji: "😊", color: "#fbbf24" },
  { value: "missing", label: "Missing You", emoji: "❤️", color: "#f472b6" },
  { value: "sad", label: "Sad", emoji: "😔", color: "#60a5fa" },
  { value: "busy", label: "Busy", emoji: "💼", color: "#a78bfa" },
  { value: "excited", label: "Excited", emoji: "✨", color: "#34d399" },
  { value: "angry", label: "Angry", emoji: "😤", color: "#f87171" },
  { value: "sleepy", label: "Sleepy", emoji: "😴", color: "#94a3b8" },
  { value: "loved", label: "Loved", emoji: "🫶", color: "#fb7185" },
];

export function getMoodInfo(mood: MoodType) {
  return MOOD_OPTIONS.find((m) => m.value === mood) ?? MOOD_OPTIONS[0];
}
