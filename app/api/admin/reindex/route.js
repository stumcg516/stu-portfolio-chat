import OpenAI from "openai";
import { NextResponse } from "next/server";
import { loadPlainTextDocs, chunkText } from "../../../../lib/chunk";
import { saveIndexJson } from "../../../../lib/blob";

export const runtime = "nodejs";

export async function GET(req) {
  const url = new URL(req.url);
  const token = url.searchParams.get("token");

  // --- Authorization check ---
  if (!token || token !== process.env.REINDEX_TOKEN) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  // --- TEMP DEBUG: check if Blob token is present ---
  if (url.searchParams.get("debug") === "1") {
    return NextResponse.json({
      hasBlobToken: !!process.env.BLOB_READ_WRITE_TOKEN,
    });
  }

  try {
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    // Load and chunk all markdown docs
    const docs = await loadPlainTextDocs();
    const records = [];
    for (const doc of docs) {
      const chunks = chunkText(doc.text, 1500, 250);
      for (let i = 0; i < chunks.length; i++) {
        records.push({
          id: `${doc.id}#${i}`,
          source: doc.id,
          text: chunks[i],
        });
      }
    }

    // Generate embeddings for each chunk
    const inputs = records.map((r) => r.text);
    const emb = await client.embeddings.create({
      model: "text-embedding-3-small",
      input: inputs.length ? inputs : ["placeholder"],
    });

    // Combine embeddings + chunks
    const indexed = records.map((r, i) => ({
      ...r,
      embedding: emb.data[i].embedding,
    }));

    // Save to Vercel Blob
    const json = JSON.stringify(indexed);
    const blobUrl = await saveIndexJson(json);

    return NextResponse.json({ ok: true, count: indexed.length, blobUrl });
  } catch (err) {
    const msg = (err && (err.message || err.toString())) || "Unknown error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
