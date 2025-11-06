// lib/blob.js
import { put, list } from "@vercel/blob";

const INDEX_BLOB_PATH = "vector_index.json";
const token = process.env.BLOB_READ_WRITE_TOKEN;

export async function saveIndexJson(jsonString) {
  const res = await put(INDEX_BLOB_PATH, jsonString, {
    access: "public",
    contentType: "application/json",
    token, // <-- pass token explicitly
  });
  return res.url;
}

export async function loadIndexJson() {
  // Find the latest vector_index.json and download it
  const { blobs } = await list({ prefix: INDEX_BLOB_PATH, limit: 1, token });
  if (!blobs || blobs.length === 0) return [];
  const res = await fetch(blobs[0].url, { cache: "no-store" });
  if (!res.ok) return [];
  return await res.json();
}
