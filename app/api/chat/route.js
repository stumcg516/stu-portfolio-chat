import OpenAI from "openai";
import { NextResponse } from "next/server";
import { topK } from "../../../lib/retriever";
import { loadIndexJson } from "../../../lib/blob";

export const runtime = "edge";

// CORS so you can call from anywhere (Webflow, localhost, etc.)
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST,GET,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization"
};

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders });
}

// Simple health check in a browser tab
export async function GET() {
  return NextResponse.json({ ok: true, msg: "chat endpoint up" }, { headers: corsHeaders });
}

export async function POST(req) {
  try {
    const { message } = await req.json();
    if (!message) {
      return NextResponse.json(
        { ok: false, error: "Missing 'message' in body" },
        { status: 400, headers: corsHeaders }
      );
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { ok: false, error: "OPENAI_API_KEY not set" },
        { status: 500, headers: corsHeaders }
      );
    }

    const index = await loadIndexJson();
    if (!index?.length) {
      return NextResponse.json(
        { answer: "I don’t have my notes loaded yet. Try reindexing.", sources: [] },
        { headers: corsHeaders }
      );
    }

    const client = new OpenAI({ apiKey });

    // Embed the query
    const qEmb = await client.embeddings.create({
      model: "text-embedding-3-small",
      input: message
    });
    const qvec = qEmb.data[0].embedding;

    // Retrieve
    const hits = topK(qvec, index, 6, 0.22);
    const context = hits.map(h => `SOURCE: ${h.source}\nTEXT: ${h.text}`).join("\n\n");

    // Generate grounded answer
    const system = `You are Stu’s portfolio guide. Answer ONLY from CONTEXT. If not present, say "I don’t have that in my notes" and suggest contacting Stu. Concise, specific, warm. End with ONE compact CTA.`;
    const user = `User question:\n${message}\n\nCONTEXT:\n${context}`;

    const resp = await client.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.2,
      messages: [{ role: "system", content: system }, { role: "user", content: user }]
    });

    const answer = resp.choices?.[0]?.message?.content?.trim() || "Sorry—blanking.";
    const sources = [...new Set(hits.map(h => h.source))].slice(0, 4);

    return NextResponse.json({ answer, sources }, { headers: corsHeaders });
  } catch (err) {
    const msg = (err && (err.message || err.toString())) || "Unknown server error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500, headers: corsHeaders });
  }
}
