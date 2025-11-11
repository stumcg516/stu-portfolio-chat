// lib/blob.js
import { put, list } from "@vercel/blob";

const INDEX_FILENAME = "vector_index.json";
const token = process.env.BLOB_READ_WRITE_TOKEN;

// Always overwrite the same filename
export async function saveIndexJson(jsonString) {
  const res = await put(INDEX_FILENAME, jsonString, {
    access: "public",
    contentType: "application/json",
    token,
  });
  return res.url;
}

// Load the MOST RECENT index blob and bypass any caching
export async function loadIndexJson() {
  const { blobs = [] } = await list({ token, limit: 100 });

  // Pick the latest upload that matches the index filename
  const candidates = blobs
    .filter(b => b.pathname.endsWith(INDEX_FILENAME))
    .sort((a, b) => {
      const ta = new Date(a.uploadedAt || a.createdAt || 0).getTime();
      const tb = new Date(b.uploadedAt || b.createdAt || 0).getTime();
      return tb - ta; // newest first
    });

  const target = candidates[0];
  if (!target) return [];

  // Force a fresh network read of the JSON
  const res = await fetch(target.url, {
    cache: "no-store",
    headers: { "Cache-Control": "no-cache" },
  });
  if (!res.ok) return [];
  return await res.json();
}
