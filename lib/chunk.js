// lib/chunk.js
import fs from "fs";
import path from "path";

const ROOT = path.join(process.cwd(), "knowledge");

function isMarkdown(name) {
  return /\.(md|mdx)$/i.test(name);
}

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (isMarkdown(e.name)) out.push(p);
  }
  return out;
}

/**
 * Recursively load all .md/.mdx under /knowledge, preserving a nice relative id.
 * We lightly prefix the content with the file name to help retrieval (“scope”, “zazzle”).
 */
export function loadPlainTextDocs() {
  const files = walk(ROOT);
  return files.map((abs) => {
    const rel = path.relative(ROOT, abs).replaceAll(path.sep, "/"); // e.g. "10_projects/picnichealth_scope.md"
    const fname = rel.split("/").pop();                               // e.g. "picnichealth_scope.md"
    const text = fs.readFileSync(abs, "utf8");
    return {
      id: rel,
      source: rel,
      // small prefix so embeddings “see” the doc name; helps project queries beat resume/bio
      text: `Title: ${fname}\n\n${text}`,
    };
  });
}

export function chunkText(full, size = 1500, overlap = 250) {
  const out = [];
  for (let i = 0; i < full.length; i += size - overlap) {
    out.push(full.slice(i, i + size));
  }
  return out;
}
