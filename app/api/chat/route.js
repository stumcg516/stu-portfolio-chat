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
  });
}

// Helper: lightly augment the search text with recent user turns
function buildSearchText(message, history = []) {
  const recentUsers = history.filter(h => h.role === "user").slice(-2);
  const prevUserText = recentUsers.map(u => u.content).join("\n");
  return [prevUserText, message].filter(Boolean).join("\n").trim();
}

// POST — answer a question using RAG over the loaded index, with chat history
export async function POST(req) {
  try {
    const body = await req.json();
    const message = typeof body?.message === "string" ? body.message : "";
    const history = Array.isArray(body?.history) ? body.history : [];

    if (!message) {
      return NextResponse.json({ error: "No message" }, { status: 400 });
    }

    const index = await ensureIndexLoaded();
    if (!index || index.length === 0) {
      return NextResponse.json({
        answer: "I don’t have my notes loaded yet. Try reindexing.",
        sources: [],
      });
    }

    // ==== Embed query (newest user + recent user turns for better coref) ====
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const searchText = buildSearchText(message, history);
    const emb = await client.embeddings.create({
      model: "text-embedding-3-small",
      input: searchText,
    });
    const q = emb.data[0].embedding;

    // cosine similarity
    const dot = (a, b) => a.reduce((s, v, i) => s + v * b[i], 0);
    const norm = (a) => Math.sqrt(dot(a, a));
    const cos = (a, b) => dot(a, b) / (norm(a) * norm(b) + 1e-9);

    const scored = index
      .map((r) => ({ ...r, score: cos(q, r.embedding) }))
      .sort((a, b) => b.score - a.score);

    const top = scored.slice(0, 5);
    const context = top.map((s) => `• ${s.text}`).join("\n");

    // Build history for the model (trim to last 8 msgs to keep prompt small)
    const historyForModel = history
      .slice(-8)
      .map(({ role, content }) => ({
        role: role === "assistant" || role === "user" ? role : "user",
        content: String(content || "").slice(0, 2000),
      }));

    const system = `You are a friendly, concise concierge for Stu McGibbon’s portfolio.
- Use the provided context when possible.
- If you’re not sure based on the notes, say so briefly and offer a helpful follow-up question.
- Keep answers conversational (not stiff) and factual.
- Never invent biographical details.`;

    const messages = [
      { role: "system", content: system },
      ...historyForModel,
      {
        role: "user",
        content: `Current question: ${message}

Use these notes (they may be partial):
${context}`,
      },
    ];

    const chat = await client.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.3, // a hair more friendly without hallucinations
      messages,
    });

    const answer =
      chat.choices[0]?.message?.content?.trim() ||
      "Sorry, I’m not sure.";

    // show only relevant sources above a UI threshold; keep all in retrieval
    const UI_MIN = 0.18;
    const sources = top
      .filter((s) => typeof s.score === "number" && s.score >= UI_MIN)
      .map((s) => ({
        id: s.id,
        source: s.source,
        score: Number(s.score.toFixed(3)),
      }));

    return NextResponse.json({ answer, sources });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
