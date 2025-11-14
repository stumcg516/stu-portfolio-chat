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

// ---------- POST: main chat handler with history ----------
export async function POST(req) {
  try {
    const { message, history = [] } = await req.json();
    if (!message || typeof message !== "string") {
      return NextResponse.json({ error: "No message" }, { status: 400 });
    }

    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    // Load RAG index (Stu's notes)
    const index = await ensureIndexLoaded();

    // ---- Build RAG context (if index is available) ----
    let context = "";
    let sources = [];

    if (index && index.length) {
      const emb = await client.embeddings.create({
        model: "text-embedding-3-small",
        input: message,
      });
      const q = emb.data[0].embedding;

      const scored = index
        .map((r) => ({ ...r, score: cos(q, r.embedding) }))
        .sort((a, b) => b.score - a.score);

      const top = scored.slice(0, 5);

      context = top.map((s) => `• [${s.source}] ${s.text}`).join("\n");

      // Only show reasonably relevant sources in the UI
      const UI_MIN = 0.18;
      sources = top
        .filter((s) => typeof s.score === "number" && s.score >= UI_MIN)
        .map((s) => ({
          id: s.id,
          source: s.source,
          score: Number(s.score.toFixed(3)),
        }));
    }

    // ---- Build conversational history for the LLM ----
    const formattedHistory = Array.isArray(history)
      ? history.map((m) => ({
          role: m.role,
          content: m.content,
        }))
      : [];

    // Append the latest user turn, including notes context
    formattedHistory.push({
      role: "user",
      content: `
User message:
${message}

Notes about Stu (these may or may not be relevant):
${context}
      `.trim(),
    });

    const systemPrompt = `
You are a warm, conversational assistant on Stu McGibbon’s portfolio site.

You have access to notes about Stu (bio, resume, and project case studies) when they are provided in the "notes" section of the user message.

Guidelines:
- When the user asks about Stu (background, roles, skills, projects, impact, etc.), treat the notes as the primary source of truth.
  - Only state concrete facts about Stu that are supported by the notes.
  - If the notes don't contain the answer, say you don't know or that it isn't in your notes yet.
- When the question is NOT about Stu (small talk, general questions, etc.), you may ignore the notes and answer normally.
- Do NOT randomly inject Stu-related information into generic or small-talk questions unless the user asks for it.
- Remember and use the prior conversation turns to keep context and avoid repeating yourself.
- When prompted for contact info, prioritize email (stu@mcgibbon.com) and linkedin -- never provide Stu's phone number. 
- When referring to what you know about Stu, do not describe these as "notes" "context provided," etc. 

Identity rules:
- You are NOT Stu.
- You were built by Stu.
- You do NOT speak as Stu in first person.
- When the user refers to “you,” they mean the assistant, NOT Stu.
- When referring to yourself, never describe having real-world actions, experiences, projects, or accomplishments. 
You are an AI assistant, not a human and not Stu.

Style:
- Be friendly, concise, and natural (like ChatGPT).
- Usually respond in 1–4 sentences, unless the user clearly wants more detail.
- Avoid unnecessary Markdown formatting, unless it comes directly from the notes.
    `.trim();

    const chat = await client.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.5,
      messages: [
        { role: "system", content: systemPrompt },
        ...formattedHistory,
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
