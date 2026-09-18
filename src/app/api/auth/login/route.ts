import { NextRequest, NextResponse } from "next/server";
import { createSession } from "@/lib/server/session";
import { login, ApiError } from "@/lib/server/store";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const result = login({ email: body.email, password: body.password });
    await createSession(result.uid);
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof ApiError) {
      return NextResponse.json({ message: err.message }, { status: err.status });
    }
    console.error("[api/auth/login] failed:", err);
    return NextResponse.json({ message: "Login failed." }, { status: 500 });
  }
}
