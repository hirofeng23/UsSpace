import imageCompression from "browser-image-compression";
import { format, differenceInYears, differenceInMonths, differenceInDays, differenceInHours, differenceInMinutes, differenceInSeconds, subDays } from "date-fns";
import type { LocalTimestamp as Timestamp } from "@/lib/timestamp";
import type { DailyMemory } from "@/types";

export function toSafeDate(value: Timestamp | null | undefined): Date | null {
  if (!value || typeof value.toDate !== "function") return null;
  return value.toDate();
}

export function toSafeMillis(value: Timestamp | null | undefined): number {
  if (!value || typeof value.toMillis !== "function") return 0;
  return value.toMillis();
}

export function formatTimestamp(
  value: Timestamp | null | undefined,
  pattern: string
): string {
  const date = toSafeDate(value);
  return date ? format(date, pattern) : "Just now";
}

export function generateCoupleCode(uid?: string): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  if (uid) {
    let code = "";
    for (let i = 0; i < uid.length && code.length < 3; i++) {
      const c = uid.charCodeAt(i) % chars.length;
      code += chars[c];
    }
    while (code.length < 6) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code.slice(0, 6);
  }
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

export function getTodayDateString(): string {
  return format(new Date(), "yyyy-MM-dd");
}

export async function compressImage(file: File): Promise<File> {
  // Skip compression if file is already smaller than our target maxSizeMB (0.8 MB)
  if (file.size < 0.8 * 1024 * 1024) {
    return file;
  }
  const options = {
    maxSizeMB: 0.8,
    maxWidthOrHeight: 1200,
    useWebWorker: true,
    initialQuality: 0.65,
  };
  return imageCompression(file, options);
}

export interface PreciseRelationshipDuration {
  years: number;
  months: number;
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

export function getPreciseRelationshipDuration(startDate: Date): PreciseRelationshipDuration {
  const now = new Date();
  
  const years = differenceInYears(now, startDate);
  const afterYears = new Date(startDate);
  afterYears.setFullYear(afterYears.getFullYear() + years);

  const months = differenceInMonths(now, afterYears);
  const afterMonths = new Date(afterYears);
  afterMonths.setMonth(afterMonths.getMonth() + months);

  const days = differenceInDays(now, afterMonths);
  const afterDays = new Date(afterMonths);
  afterDays.setDate(afterDays.getDate() + days);

  const hours = differenceInHours(now, afterDays);
  const afterHours = new Date(afterDays);
  afterHours.setHours(afterHours.getHours() + hours);

  const minutes = differenceInMinutes(now, afterHours);
  const afterMinutes = new Date(afterHours);
  afterMinutes.setMinutes(afterMinutes.getMinutes() + minutes);

  const seconds = differenceInSeconds(now, afterMinutes);

  return { years, months, days, hours, minutes, seconds };
}

export function formatCountdown(ms: number): string {
  if (ms <= 0) return "Ready!";
  const hours = Math.floor(ms / (1000 * 60 * 60));
  const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((ms % (1000 * 60)) / 1000);
  if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

export const HOURS_24_MS = 24 * 60 * 60 * 1000;
export const HOURS_5_MS = 5 * 60 * 60 * 1000;

export function getOptimizedCloudinaryUrl(url: string, width?: number): string {
  if (!url || !url.includes("cloudinary.com")) return url;
  const insertionPoint = "/image/upload";
  if (!url.includes(insertionPoint)) return url;
  const optimizationParams = width ? `/f_auto,q_auto,w_${width}` : "/f_auto,q_auto";
  return url.replace(insertionPoint, `${insertionPoint}${optimizationParams}`);
}

export interface StreakResult {
  count: number;
  todayComplete: boolean;
  hasStreak: boolean;
}

export function calculateStreak(memories: DailyMemory[], memberIds: string[]): StreakResult {
  if (!memberIds || memberIds.length < 2 || !memories || memories.length === 0) {
    return { count: 0, todayComplete: false, hasStreak: false };
  }

  const uploadsByDate: Record<string, Set<string>> = {};
  memories.forEach((m) => {
    if (!uploadsByDate[m.uploadDate]) {
      uploadsByDate[m.uploadDate] = new Set();
    }
    uploadsByDate[m.uploadDate].add(m.userId);
  });

  const isDateComplete = (dateStr: string) => {
    const uploaders = uploadsByDate[dateStr];
    return uploaders && memberIds.every((id) => uploaders.has(id));
  };

  const todayStr = format(new Date(), "yyyy-MM-dd");
  const yesterdayStr = format(subDays(new Date(), 1), "yyyy-MM-dd");

  const todayComplete = isDateComplete(todayStr);
  const yesterdayComplete = isDateComplete(yesterdayStr);

  let count = 0;
  if (todayComplete) {
    count = 1;
    let checkDate = subDays(new Date(), 1);
    while (isDateComplete(format(checkDate, "yyyy-MM-dd"))) {
      count++;
      checkDate = subDays(checkDate, 1);
    }
  } else if (yesterdayComplete) {
    count = 1;
    let checkDate = subDays(new Date(), 2);
    while (isDateComplete(format(checkDate, "yyyy-MM-dd"))) {
      count++;
      checkDate = subDays(checkDate, 1);
    }
  }

  return {
    count,
    todayComplete,
    hasStreak: count > 0,
  };
}
