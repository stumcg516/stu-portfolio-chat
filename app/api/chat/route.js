// app/api/chat/route.js
import { NextResponse } from "next/server";
import OpenAI from "openai";
import { loadIndexJson } from "../../../lib/blob";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// ---------- in-memory index cache ----------
let INDEX = globalThis.__STU_INDEX || null;
let INDEX_LOADED_AT = globalThis.__STU_INDEX_LOADED_AT || 0;

async function ensureIndexLoaded(force = false) {
  const FRESH_MS = 5 * 60 * 1000; // 5 minutes
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

// ---------- similarity helpers ----------
const dot = (a, b) => a.reduce((s, v, i) => s + v * b[i], 0);
const norm = (a) => Math.sqrt(dot(a, a));
const cos = (a, b) => dot(a, b) / (norm(a) * norm(b) + 1e-9);

// ---------- GET: health / debug ----------
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

// ---------- POST: main chat handler ----------
export async function POST(req) {
  try {
    const { message } = await req.json();
    if (!message || typeof message !== "string") {
      return NextResponse.json({ error: "No message" }, { status: 400 });
    }

    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    // Try to load Stu’s notes
    const index = await ensureIndexLoaded();

    // If we *can’t* load notes, still be helpful, but be honest about Stu
    if (!index || index.length === 0) {
      const chat = await client.chat.completions.create({
        model: "gpt-4o-mini",
        temperature: 0.7,
        messages: [
          {
            role: "system",
            content:
              "You are a warm, conversational assistant embedded on Stu McGibbon’s portfolio site. " +
              "You currently do NOT have access to Stu’s notes or resume. " +
              "If the user asks for specific facts about Stu’s background, roles, projects, or achievements, " +
              "be transparent that you don’t have that information. " +
              "For all other questions (small talk, general knowledge, etc.) respond naturally and helpfully.",
          },
          { role: "user", content: message },
        ],
      });

      const answer =
        chat.choices[0]?.message?.content?.trim() ||
        "I’m having trouble loading Stu’s notes right now, but I’m happy to chat.";
      return NextResponse.json({ answer, sources: [] });
    }

    // We *do* have an index → compute embedding & similarity
    const emb = await client.embeddings.create({
      model: "text-embedding-3-small",
      input: message,
    });
    const q = emb.data[0].embedding;

    const scored = index
      .map((r) => ({ ...r, score: cos(q, r.embedding) }))
      .sort((a, b) => b.score - a.score);

    const top = scored.slice(0, 5);

    const context = top.map((s) => `• [${s.source}] ${s.text}`).join("\n");

    // We only use this threshold to decide which sources to *show* in the UI,
    // not to gate whether the model is allowed to answer.
    const UI_MIN = 0.18;
    const sources = top
      .filter((s) => typeof s.score === "number" && s.score >= UI_MIN)
      .map((s) => ({
        id: s.id,
        source: s.source,
        score: Number(s.score.toFixed(3)),
      }));

    const systemPrompt = `
You are a friendly, conversational concierge for Stu McGibbon’s portfolio site.

You have access to a set of notes about Stu (bio, resume, and project case studies), provided as "notes" below.

**How to use the notes vs general knowledge**

- When the user asks about Stu (his background, skills, projects, roles, impact, etc.), you MUST treat the notes as the primary source of truth.
  - Only state concrete facts about Stu that are supported by the notes.
  - If the notes don’t contain the answer, say you don’t know or that it isn’t in your notes yet.
- When the user’s question is NOT about Stu (general questions, small talk, random ideas, etc.), you may ignore the notes and answer like a normal helpful assistant.
- Do NOT randomly inject Stu-related information into generic or small-talk questions unless the user asks for it.

**Style**

- Be warm, concise, and natural — similar to ChatGPT.
- 1–4 sentences is usually enough unless the user explicitly asks for more detail.
- Avoid unnecessary Markdown formatting (like bolding random phrases) unless it’s already in the notes.
`;

    const userPrompt = `
User question:
${message}

Notes about Stu (may or may not be relevant to this question):
${context}
`.trim();

    const chat = await client.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.5,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    });

    const answer =
      chat.choices[0]?.message?.content?.trim() ||
      "Sorry, I’m not sure how to answer that.";

    return NextResponse.json({ answer, sources });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
