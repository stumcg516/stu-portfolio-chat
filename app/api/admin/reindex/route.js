import OpenAI from "openai";
import { NextResponse } from "next/server";
import { loadPlainTextDocs, chunkText } from "../../../../lib/chunk";
import { saveIndexJson } from "../../../../lib/blob";

export const runtime = "nodejs";

export async function GET(req) {
  const url = new URL(req.url);
  const token = url.searchParams.get("token");
  if (!token || token !== process.env.REINDEX_TOKEN) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  try {
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const docs = await loadPlainTextDocs();
    const records = [];
    for (const doc of docs) {
      const chunks = chunkText(doc.text, 1500, 250);
      for (let i = 0; i < chunks.length; i++) {
        records.push({ id: `${doc.id}#${i}`, source: doc.id, text: chunks[i] });
      }
    }

    const inputs = records.map(r => r.text);
    const emb = await client.embeddings.create({
      model: "text-embedding-3-small",
      input: inputs.length ? inputs : ["placeholder"]
    });

    const indexed = records.map((r, i) => ({ ...r, embedding: emb.data[i].embedding }));
    const json = JSON.stringify(indexed);
    const blobUrl = await saveIndexJson(json);

    return NextResponse.json({ ok: true, count: indexed.length, blobUrl });
  } catch (err) {
    // Return the message so we can see what's wrong
    const msg = (err && (err.message || err.toString())) || "Unknown error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
