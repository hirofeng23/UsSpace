// Local replacement for Cloudinary. Uploads go to this app's own
// /api/upload route, which writes the file into public/uploads/ on disk and
// hands back a plain local URL (e.g. "/uploads/ab12cd34.jpg"). Nothing is
// sent to any third party, and there is nothing to configure.
//
// Function names/signatures are unchanged from the original file so every
// caller (vault, settings, firestore.ts) keeps working as-is.

export async function uploadToCloudinary(file: File, signal?: AbortSignal): Promise<string> {
  if (!file || !file.type.startsWith("image/")) {
    throw new Error("Invalid image file provided.");
  }

  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch("/api/upload", { method: "POST", body: formData, signal });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData?.message || "Upload failed.");
  }
  const data = await response.json();
  return data.url as string;
}

export async function uploadAudioToCloudinary(file: File): Promise<string> {
  if (!file || !file.type.startsWith("audio/")) {
    throw new Error("Invalid audio file provided.");
  }

  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch("/api/upload", { method: "POST", body: formData });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData?.message || "Upload failed.");
  }
  const data = await response.json();
  return data.url as string;
}
