import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import { remark } from "remark";
import strip from "strip-markdown";

const KNOWLEDGE_DIR = path.join(process.cwd(), "knowledge");

export async function loadPlainTextDocs() {
  const files = fs.readdirSync(KNOWLEDGE_DIR).filter(f => f.endsWith(".md"));
  const docs = [];
  for (const file of files) {
    const raw = fs.readFileSync(path.join(KNOWLEDGE_DIR, file), "utf8");
    const parsed = matter(raw);
    const processed = await remark().use(strip).process(parsed.content);
    const text = String(processed).replace(/\n{3,}/g, "\n\n").trim();
    docs.push({ id: file, text });
  }
  return docs;
}

export function chunkText(text, chunkSize = 1500, overlap = 250) {
  const chunks = [];
  let i = 0;
  while (i < text.length) {
    const end = Math.min(text.length, i + chunkSize);
    const slice = text.slice(i, end);
    chunks.push(slice.trim());
    i += chunkSize - overlap;
  }
  return chunks.filter(Boolean);
}