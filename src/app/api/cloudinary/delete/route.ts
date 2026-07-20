import { NextRequest, NextResponse } from "next/server";

export const runtime = "edge";

async function sha1(str: string): Promise<string> {
  const buf = await crypto.subtle.digest(
    "SHA-1",
    new TextEncoder().encode(str)
  );
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function POST(req: NextRequest) {
  try {
    const { publicId } = await req.json();
    const timestamp = Math.round(Date.now() / 1000);
    const signature = await sha1(
      `public_id=${publicId}&timestamp=${timestamp}${process.env.CLOUDINARY_API_SECRET}`
    );

    const fd = new FormData();
    fd.append("public_id", publicId);
    fd.append("timestamp", String(timestamp));
    fd.append("api_key", process.env.CLOUDINARY_API_KEY!);
    fd.append("signature", signature);

    const res = await fetch(
      `https://api.cloudinary.com/v1_1/${process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME}/image/destroy`,
      { method: "POST", body: fd }
    );

    return res.ok
      ? NextResponse.json({ success: true })
      : NextResponse.json({ error: "Delete failed" }, { status: 500 });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
