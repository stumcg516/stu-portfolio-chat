// app/api/chat/route.js
import { NextResponse } from "next/server";
import OpenAI from "openai";
import { loadIndexJson } from "../../../lib/blob";

export const runtime = "nodejs";

// simple in-memory cache between requests
let INDEX = null;
let INDEX_LOADED_AT = 0;

async function ensureIndexLoaded() {
  const FRESH_MS = 5 * 60 * 1000; // refresh every 5 min
  const stale = !INDEX || (Date.now() - INDEX_LOADED_AT) > FRESH_MS;
  if (!stale) return INDEX;

  const arr = await loadIndexJson();
  if (Array.isArray(arr) && arr.length > 0) {
    INDEX = arr;
    INDEX_LOADED_AT = Date.now();
    return INDEX;
  }
  return null;
}

export async function GET() {
  return NextResponse.json({ ok: true, msg: "chat endpoint up" });
}

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
        sources: []
      });
    }

    // naive top-k using cosine similarity
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    // get an embedding for the query
    const emb = await client.embeddings.create({
      model: "text-embedding-3-small",
      input: message
    });
    const q = emb.data[0].embedding;

    // cosine similarity
    function dot(a, b) { let s = 0; for (let i = 0; i < a.length; i++) s += a[i] * b[i]; return s; }
    function norm(a) { return Math.sqrt(dot(a, a)); }
    function cos(a, b) { return dot(a, b) / (norm(a) * norm(b) + 1e-9); }

    const scored = index
      .map(r => ({ ...r, score: cos(q, r.embedding) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);

    const context = scored.map(s => `• ${s.text}`).join("\n");
    const system = `You are an assistant answering questions about Stu McGibbon.
Use only the provided context when possible. If unsure, say you don't know. Keep answers concise.`;

    const chat = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: system },
        { role: "user", content: `Question: ${message}\n\nContext:\n${context}` }
      ],
      temperature: 0.2
    });

    const answer = chat.choices[0]?.message?.content?.trim() || "Sorry, I’m not sure.";
    const sources = scored.map(s => ({ id: s.id, source: s.source, score: Number(s.score.toFixed(3)) }));

    return NextResponse.json({ answer, sources });
  } catch (err) {
    const msg = (err && (err.message || err.toString())) || "Server error";
    // Return a parsable error so the console test doesn't choke
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
