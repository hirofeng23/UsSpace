// Local replacement for Cloudinary. Saves the uploaded image/audio file into
// public/uploads/ (created automatically) and returns a plain local URL like
// "/uploads/<id>.jpg" that Next.js serves as a static file — nothing to
// configure, nothing leaves this machine.

import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import { getSessionUid } from "@/lib/server/session";
import { getUploadsDir, newId } from "@/lib/server/db";

const MAX_BYTES = 15 * 1024 * 1024; // 15MB, generous for a compressed photo or a short audio clip

const EXTENSION_BY_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/heic": "heic",
  "audio/mpeg": "mp3",
  "audio/mp3": "mp3",
  "audio/wav": "wav",
  "audio/x-wav": "wav",
  "audio/ogg": "ogg",
  "audio/webm": "webm",
  "audio/mp4": "m4a",
  "audio/x-m4a": "m4a",
};

export async function POST(req: NextRequest) {
  const uid = await getSessionUid();
  if (!uid) return NextResponse.json({ message: "Not signed in." }, { status: 401 });

  const formData = await req.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ message: "No file provided." }, { status: 400 });
  }
  if (!file.type.startsWith("image/") && !file.type.startsWith("audio/")) {
    return NextResponse.json({ message: "Only image or audio files are allowed." }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ message: "File is too large (max 15MB)." }, { status: 400 });
  }

  const extFromName = path.extname(file.name || "").replace(".", "").toLowerCase();
  const ext = EXTENSION_BY_MIME[file.type] || extFromName || "bin";
  const filename = `${newId()}.${ext}`;

  const buffer = Buffer.from(await file.arrayBuffer());
  await fs.writeFile(path.join(getUploadsDir(), filename), buffer);

  return NextResponse.json({ url: `/uploads/${filename}` });
}
