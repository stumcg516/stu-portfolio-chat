// app/api/chat/route.js
import { NextResponse } from "next/server";
import OpenAI from "openai";
import { loadIndexJson } from "../../../lib/blob";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// -------- in-memory index cache (persists on warm lambdas) ----------
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

// ---------- utils ----------
const dot = (a, b) => a.reduce((s, v, i) => s + v * b[i], 0);
const norm = (a) => Math.sqrt(dot(a, a));
const cos = (a, b) => dot(a, b) / (norm(a) * norm(b) + 1e-9);

// Dedupe listed sources by file, keep best score per file, thresholded
function formatSourcesForUi(chunks, { max = 4, threshold = 0.28 } = {}) {
  const byFile = new Map();
  for (const c of chunks) {
    const file = c.source || c.id; // fall back to id if no source
    const prev = byFile.get(file);
    if (!prev || c.score > prev.score) byFile.set(file, { source: file, score: c.score });
  }
  return [...byFile.values()]
    .sort((a, b) => b.score - a.score)
    .filter((s) => s.score >= threshold)
    .slice(0, max)
    .map((s) => ({ source: s.source, score: Number(s.score.toFixed(2)) }));
}

// ------------------ GET: health / manual refresh -------------------
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

// ------------------ POST: chat with RAG ----------------------------
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

    // Embed the question
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const emb = await client.embeddings.create({
      model: "text-embedding-3-small",
      input: message,
    });
    const q = emb.data[0].embedding;

    // Rank by cosine similarity
    const ranked = index
      .map((r) => {
        let score = cos(q, r.embedding);

         // 🎯 Gentle bias toward Patient Surveys
        if (r.source?.toLowerCase().includes("patient_survey")) {
          score *= 1.08; // ~8% boost
        }

        return { ...r, score };
    })
    .sort((a, b) => b.score - a.score);

    const ranked = index
      .map((r) => ({ ...r, score: cos(q, r.embedding) }))
      .sort((a, b) => b.score - a.score);

    const topK = ranked.slice(0, 6); // use multiple chunks to write the answer
    const context = topK.map((s) => `• ${s.text}`).join("\n");

    // System prompt: friendly but grounded
    const system = `You are a warm, conversational assistant that helps visitors learn about Stu McGibbon — his background, work, and design philosophy.
Use the provided context as your factual source. If the context doesn’t include an answer, reply naturally (e.g., "I’m not totally sure about that, but I can tell you about…") rather than just "I don't know."
Be concise, helpful, and friendly — like a portfolio site concierge. Never invent factual details beyond the provided context.
Respond in plain text only (no Markdown formatting like **bold**).`;

    const chat = await client.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.4, // a bit more conversational
      messages: [
        { role: "system", content: system },
        { role: "user", content: `Question: ${message}\n\nContext:\n${context}` },
      ],
    });

    const answer =
      chat.choices[0]?.message?.content?.trim() ||
      "Sorry, I’m not sure.";

    // UI sources: unique files only, hide weak matches
    const sources = formatSourcesForUi(topK, {
      max: 4,
      threshold: 0.28, // adjust if you want fewer/stricter source badges
    });

    return NextResponse.json({ answer, sources });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
