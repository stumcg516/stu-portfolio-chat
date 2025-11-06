import { NextResponse } from "next/server";
import { loadIndexJson } from "../../../../lib/blob";

export const runtime = "nodejs";

export async function GET() {
  try {
    const arr = await loadIndexJson();
    return NextResponse.json({
      ok: true,
      count: Array.isArray(arr) ? arr.length : 0,
      sample: (arr || []).slice(0, 2).map(r => ({
        id: r.id,
        source: r.source,
        preview: r.text.slice(0, 80),
      })),
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
