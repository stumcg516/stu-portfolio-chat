// app/api/chat/route.js
import { NextResponse } from "next/server";
import OpenAI from "openai";
import { loadIndexJson } from "../../../lib/blob";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// in-memory cache (persists across requests on a warm function)
let INDEX = globalThis.__STU_INDEX || null;
let INDEX_LOADED_AT = globalThis.__STU_INDEX_LOADED_AT || 0;

async function ensureIndexLoaded(force = false) {
  const FRESH_MS = 5 * 60 * 1000; // refresh every 5 min
  const stale = force || !INDEX || (Date.now() - INDEX_LOADED_AT) > FRESH_MS;
  if (!stale) return INDEX;

  const arr = await loadIndexJson();
  if (Array.isArray(arr) && arr.length) {
    INDEX = arr;
    INDEX_LOADED_AT = Date.now();
    globalThis.__STU_INDEX = INDEX;
    globalThis.__STU_INDEX_LOADED_AT = INDEX_LOADED_AT;
    return INDEX;
  }
  return null;
}

// GET — health + optional refresh
export async function GET(req) {
  const url = new URL(req.url);
  const refresh = url.searchParams.get("refresh") === "1";
  const idx = await ensureIndexLoaded(refresh);
  return NextResponse.json({
    ok: true,
    loaded: !!idx,
    size: idx ? idx.length : 0,
    refreshed: refresh,
  });
}

// POST — answer a question using RAG over the loaded index
export async function POST(req) {
  try {
    const { message } = await req.json();
    if (!message || typeof message !== "string") {
      return NextResponse.json({ error: "No message" }, { status: 400 });
    }

    const index = await ensureIndexLoaded();
    if (!index || index.length === 0) {
      return NextResponse.json({
        answer: "I don’t have my notes loaded yet. Try reindexing.",
        sources: [],
      });
    }

    // embed question
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const emb = await client.embeddings.create({
      model: "text-embedding-3-small",
      input: message,
    });
    const q = emb.data[0].embedding;

    // cosine similarity
    const dot = (a,b)=>a.reduce((s,v,i)=>s+v*b[i],0);
    const norm = a => Math.sqrt(dot(a,a));
    const cos = (a,b) => dot(a,b) / (norm(a)*norm(b) + 1e-9);

    const top = index
      .map(r => ({ ...r, score: cos(q, r.embedding) }))
      .sort((a,b) => b.score - a.score)
      .slice(0, 5);

    const context = top.map(s => `• ${s.text}`).join("\n");
    const system = `You are an assistant answering questions about Stu McGibbon.
Use only the provided context when possible; if unsure, say you don't know. Keep answers concise.`;

    const chat = await client.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.2,
      messages: [
        { role: "system", content: system },
        { role: "user", content: `Question: ${message}\n\nContext:\n${context}` },
      ],
    });

    const answer = chat.choices[0]?.message?.content?.trim() || "Sorry, I’m not sure.";
    const sources = top.map(s => ({ id: s.id, source: s.source, score: Number(s.score.toFixed(3)) }));
    return NextResponse.json({ answer, sources });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
