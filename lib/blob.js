// lib/blob.js
import { put, list } from "@vercel/blob";

const INDEX_FILENAME = "vector_index.json";
const token = process.env.BLOB_READ_WRITE_TOKEN;

export async function saveIndexJson(jsonString) {
  // Always overwrite the same filename
  const res = await put(INDEX_FILENAME, jsonString, {
    access: "public",
    contentType: "application/json",
    token,
  });
  return res.url;
}

export async function loadIndexJson() {
  // List everything; find our file by exact name
  const { blobs = [] } = await list({ token, limit: 100 });
  const target = blobs.find(b => b.pathname === INDEX_FILENAME)
             || blobs.find(b => b.pathname.endsWith(INDEX_FILENAME));
  if (!target) return [];
  const res = await fetch(target.url, { cache: "no-store" });
  if (!res.ok) return [];
  return await res.json();
}
