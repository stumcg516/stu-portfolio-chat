import OpenAI from "openai";
import { NextResponse } from "next/server";
import { loadIndexJson } from "@/lib/blob";
import { topK } from "@/lib/retriever";

export const runtime = "edge"; // faster cold starts

export async function POST(req) {
  try {
    const { message } = await req.json();
    if (!message) return new NextResponse("Missing message", { status: 400 });

    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    // Embed query
    const qEmb = await client.embeddings.create({
      model: "text-embedding-3-small",
      input: message
    });
    const qvec = qEmb.data[0].embedding;

    // Retrieve
    const index = await loadIndexJson();
    if (!index.length) {
      return NextResponse.json({
        answer: "I don’t have my notes loaded yet. Try again in a minute.",
        sources: []
      });
    }

    const hits = topK(qvec, index, 6, 0.22);
    const context = hits.map(h => `SOURCE: ${h.source}\nTEXT: ${h.text}`).join("\n\n");
    const system = `You are Stu’s portfolio guide. Answer ONLY from CONTEXT. If not present, say "I don’t have that in my notes" and suggest contacting Stu. Concise, specific, professional-but-warm. End with ONE compact CTA.`;
    const user = `User question:\n${message}\n\nCONTEXT:\n${context}`;

    const resp = await client.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.2,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user }
      ]
    });

    const answer = resp.choices?.[0]?.message?.content?.trim() || "Sorry—blanking.";
    const sources = [...new Set(hits.map(h => h.source))].slice(0, 4);

    return NextResponse.json({ answer, sources });
  } catch (e) {
    return new NextResponse("Server error", { status: 500 });
  }
}
