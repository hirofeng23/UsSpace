import { NextRequest, NextResponse } from "next/server";
import { createSession } from "@/lib/server/session";
import { signup, ApiError } from "@/lib/server/store";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const result = signup({
      email: body.email,
      password: body.password,
      name: body.name,
      gender: body.gender,
      relationshipStartDate: body.relationshipStartDate,
    });
    await createSession(result.uid);
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof ApiError) {
      return NextResponse.json({ message: err.message }, { status: err.status });
    }
    console.error("[api/auth/signup] failed:", err);
    return NextResponse.json({ message: "Signup failed." }, { status: 500 });
  }
}
