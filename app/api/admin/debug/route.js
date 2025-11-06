import { NextResponse } from "next/server";
export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({
    vercelEnv: process.env.VERCEL_ENV || process.env.NODE_ENV,
    hasOPENAI: !!process.env.OPENAI_API_KEY,
    hasREINDEX: !!process.env.REINDEX_TOKEN,
    hasBLOB: !!process.env.BLOB_READ_WRITE_TOKEN,
    blobTokenPrefix: process.env.BLOB_READ_WRITE_TOKEN
      ? process.env.BLOB_READ_WRITE_TOKEN.slice(0, 12) + "…"
      : null,
  });
}
