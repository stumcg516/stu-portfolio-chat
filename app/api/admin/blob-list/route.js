import { NextResponse } from "next/server";
import { list } from "@vercel/blob";

export const runtime = "nodejs";

export async function GET() {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  const out = await list({ token, limit: 50 }); // list first 50 blobs
  return NextResponse.json({
    ok: true,
    count: out?.blobs?.length || 0,
    names: (out?.blobs || []).map(b => b.pathname),
  });
}
