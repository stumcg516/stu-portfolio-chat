// app/api/chat/route.js
import { NextResponse } from "next/server";
import OpenAI from "openai";
import { loadIndexJson } from "../../../lib/blob";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// ---- Warm-function in-memory cache of the vector index
let INDEX = globalThis.__STU_INDEX || null;
let INDEX_LOADED_AT = globalThis.__STU_INDEX_LOADED_AT || 0;

async function ensureIndexLoaded(force = false) {
  const FRESH_MS = 5 * 60 * 1000; // reload every 5 minutes
  const stale = force || !INDEX || Date.now() - INDEX_LOADED_AT > FRESH_MS;
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
    loadedAt: INDEX_LOADED_AT || null,
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

    // ---- Embed question (use the larger model for slightly better ranking)
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const emb = await client.embeddings.create({
      model: "text-embedding-3-large",
      input: message,
    });
    const q = emb.data[0].embedding;

    // ---- Cosine similarity helpers
    const dot = (a, b) => a.reduce((s, v, i) => s + v * b[i], 0);
    const norm = (a) => Math.sqrt(dot(a, a));
    const cos = (a, b) => dot(a, b) / (norm(a) * norm(b) + 1e-9);

    // ---- Rank and filter low-confidence hits
    const ranked = index
      .map((r) => ({ ...r, score: cos(q, r.embedding) }))
      .sort((a, b) => b.score - a.score);

    const MIN_SIM = 0.35; // raise to 0.40 if you still see off-topic sources
    const TOP_K = 3;

    const top = ranked.filter((r) => r.score >= MIN_SIM).slice(0, TOP_K);

    if (top.length === 0) {
      return NextResponse.json({
        answer:
          "I don’t have enough information in my notes to answer that confidently.",
        sources: [],
      });
    }

    // ---- Build compact context from only the filtered hits
    const context = top
      .map((s) => `Source: ${s.source}\n${s.text}`)
      .join("\n\n---\n\n");

    // ---- System: plain text only (no Markdown), concise, cite only provided context
    const system = `You are an assistant answering questions about Stu McGibbon.
Use only the provided context. If the context does not contain an answer, say you don't know.
Respond in plain text only (no Markdown, no **bold**, no lists). Keep answers concise.`;

    const chat = await client.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.2,
      messages: [
        { role: "system", content: system },
        { role: "user", content: `Question: ${message}\n\nContext:\n${context}` },
      ],
    });

    // ---- Cleanup: strip any Markdown the model might still emit
    const raw = chat.choices[0]?.message?.content?.trim() || "Sorry, I’m not sure.";
    const answer = raw
      .replace(/\*\*(.*?)\*\*/g, "$1")
      .replace(/__([^_]+)__/g, "$1")
      .replace(/`([^`]+)`/g, "$1");

    const sources = top.map((s) => ({
      id: s.id,
      source: s.source,
      score: Number(s.score.toFixed(2)),
    }));

    return NextResponse.json({ answer, sources });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
