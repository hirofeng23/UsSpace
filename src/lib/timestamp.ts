// Drop-in replacement for Firebase's `Timestamp` class.
//
// TwoFrames used to store every date as a Firestore `Timestamp` (an object with
// `.toDate()` / `.toMillis()`). Dozens of components call those methods. Rather
// than touch every call site when we removed Firebase, this class reproduces
// the same tiny interface so existing code keeps working unmodified.
//
// Wire format (what actually travels over JSON between the local API routes
// and the browser): { __ts: true, seconds: number, nanoseconds: number }.
// `revive()` below turns that shape back into a `LocalTimestamp` instance
// after `fetch().json()` (plain JSON has no classes/methods).

export class LocalTimestamp {
  readonly seconds: number;
  readonly nanoseconds: number;

  constructor(seconds: number, nanoseconds = 0) {
    this.seconds = seconds;
    this.nanoseconds = nanoseconds;
  }

  toDate(): Date {
    return new Date(this.seconds * 1000 + Math.floor(this.nanoseconds / 1e6));
  }

  toMillis(): number {
    return this.seconds * 1000 + Math.floor(this.nanoseconds / 1e6);
  }

  toJSON() {
    return { __ts: true, seconds: this.seconds, nanoseconds: this.nanoseconds };
  }

  static now(): LocalTimestamp {
    return LocalTimestamp.fromMillis(Date.now());
  }

  static fromDate(date: Date): LocalTimestamp {
    return LocalTimestamp.fromMillis(date.getTime());
  }

  static fromMillis(ms: number): LocalTimestamp {
    return new LocalTimestamp(Math.floor(ms / 1000), (ms % 1000) * 1e6);
  }
}

// Recursively walk a value parsed from `fetch().json()` and turn any
// `{__ts:true,...}` marker objects back into LocalTimestamp instances so
// `.toDate()`/`.toMillis()` work on the client exactly like they used to.
export function reviveTimestamps<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((v) => reviveTimestamps(v)) as unknown as T;
  }
  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    if (obj.__ts === true && typeof obj.seconds === "number") {
      return new LocalTimestamp(obj.seconds, (obj.nanoseconds as number) || 0) as unknown as T;
    }
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(obj)) {
      out[key] = reviveTimestamps(obj[key]);
    }
    return out as T;
  }
  return value;
}
