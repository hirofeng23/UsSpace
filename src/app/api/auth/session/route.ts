import { NextResponse } from "next/server";
import { getSessionUid } from "@/lib/server/session";
import { getUserProfile } from "@/lib/server/store";

// Called once on app load to restore the signed-in state from the session
// cookie — this replaces Firebase's onAuthStateChanged.
export async function GET() {
  const uid = await getSessionUid();
  if (!uid) return NextResponse.json({ user: null, profile: null });

  const profile = getUserProfile(uid);
  if (!profile) return NextResponse.json({ user: null, profile: null });

  return NextResponse.json({ user: { uid, email: profile.email }, profile });
}
