// app/api/chat/route.js
import { NextResponse } from "next/server";
import OpenAI from "openai";
import { loadIndexJson } from "../../../lib/blob";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// --- in-memory index cache ---
let INDEX = globalThis.__STU_INDEX || null;
let INDEX_LOADED_AT = globalThis.__STU_INDEX_LOADED_AT || 0;

async function ensureIndexLoaded(force = false) {
  const FRESH_MS = 5 * 60 * 1000;
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

// ---- helpers ----
function buildSearchText(message, history = []) {
  const recentUsers = history.filter(h => h.role === "user").slice(-2);
  const prevUserText = recentUsers.map(u => u.content).join("\n");
  return [prevUserText, message].filter(Boolean).join("\n").trim();
}

// Very simple acknowledgement / small-talk detector
const ACK_PATTERNS = [
  "ok", "okay", "k", "kk", "cool", "nice", "great", "sounds good",
  "got it", "roger", "understood", "makes sense", "no worries",
  "thanks", "thank you", "ty", "cheers", "lol", "haha", "umm", "hmm",
  "yo", "hey", "hi", "👍", "👌", "✅"
];
function isAckLike(text) {
  const t = (text || "").trim().toLowerCase();
  if (!t) return true;
  if (t.length <= 3) return true; // “ok”, “yo”, etc.
  return ACK_PATTERNS.some(p => t.includes(p));
}

export async function POST(req) {
  try {
    const body = await req.json();
    const message = typeof body?.message === "string" ? body.message : "";
    const history = Array.isArray(body?.history) ? body.history : [];

    if (!message) {
      return NextResponse.json({ error: "No message" }, { status: 400 });
    }

    // 1) Handle small-talk / acknowledgements gracefully (no RAG)
    if (isAckLike(message) && !/[?]/.test(message)) {
      return NextResponse.json({
        answer:
          "Got it! What would you like to explore next — projects, strengths, or Stu’s background?",
        sources: [],
      });
    }

    // 2) Load vector index
    const index = await ensureIndexLoaded();
    if (!index || index.length === 0) {
      return NextResponse.json({
        answer: "I don’t have my notes loaded yet. Try reindexing.",
        sources: [],
      });
    }

    // 3) Retrieve with a bit of recent-user context for follow-ups
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const searchText = buildSearchText(message, history);
    const emb = await client.embeddings.create({
      model: "text-embedding-3-small",
      input: searchText,
    });
    const q = emb.data[0].embedding;

    const dot = (a, b) => a.reduce((s, v, i) => s + v * b[i], 0);
    const norm = (a) => Math.sqrt(dot(a, a));
    const cos = (a, b) => dot(a, b) / (norm(a) * norm(b) + 1e-9);

    const scored = index
      .map((r) => ({ ...r, score: cos(q, r.embedding) }))
      .sort((a, b) => b.score - a.score);

    const top = scored.slice(0, 5);
    const bestScore = top[0]?.score ?? 0;

    // 4) If nothing is truly relevant, don’t make stuff up — ask a follow-up
    const ANSWER_MIN = 0.22; // raise/lower to taste
    if (bestScore < ANSWER_MIN) {
      return NextResponse.json({
        answer:
          "I’m not seeing anything in my notes for that. Want to ask about projects, strengths, or background?",
        sources: [],
      });
    }

    const context = top.map((s) => `• ${s.text}`).join("\n");

    // 5) Build conversation for the model
    const historyForModel = history.slice(-8).map(({ role, content }) => ({
      role: role === "assistant" || role === "user" ? role : "user",
      content: String(content || "").slice(0, 2000),
    }));

    const system = `You are a friendly, concise concierge for Stu McGibbon’s portfolio.
- Answer ONLY if the user's message asks for information or help.
- Use the provided context when possible; if unsure, say so briefly and ask a clarifying question.
- Keep replies tight (1–4 sentences unless asked for more).
- Do NOT add decorative formatting like **bold** unless the notes already include it.
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
      temperature: 0.3,
      max_tokens: 300,
      messages,
    });

    const answer =
      chat.choices[0]?.message?.content?.trim() ||
      "Sorry, I’m not sure.";

    // Only show reasonably relevant sources in the UI
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
