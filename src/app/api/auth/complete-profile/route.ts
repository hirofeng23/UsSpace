import { NextRequest, NextResponse } from "next/server";
import { getSessionUid } from "@/lib/server/session";
import { getUserProfile, updateUserProfile, ApiError } from "@/lib/server/store";

// In the original app this handled the case where someone signed in with
// Google/Apple (an auth account with no profile document yet). TwoFrames now
// only supports email/password, and signup always creates the profile in one
// step, so this route is effectively unreachable in normal use — kept only
// so the /complete-profile page (still in the codebase) doesn't 404 if
// something ever lands there.
export async function POST(req: NextRequest) {
  const uid = await getSessionUid();
  if (!uid) return NextResponse.json({ message: "Not signed in." }, { status: 401 });

  try {
    const body = await req.json();
    updateUserProfile(uid, {
      name: body.name,
      relationshipStartDate: body.relationshipStartDate,
      onboarded: false,
    });
    return NextResponse.json({ profile: getUserProfile(uid) });
  } catch (err) {
    if (err instanceof ApiError) {
      return NextResponse.json({ message: err.message }, { status: err.status });
    }
    return NextResponse.json({ message: "Failed to save profile." }, { status: 500 });
  }
}
