import { put, list } from "@vercel/blob";

const INDEX_BLOB_PATH = "vector_index.json";
const token = process.env.BLOB_READ_WRITE_TOKEN; // <-- must read from env

export async function saveIndexJson(jsonString) {
  const res = await put(INDEX_BLOB_PATH, jsonString, {
    access: "public",
    contentType: "application/json",
    token, // <-- pass token
  });
  return res.url;
}

export async function loadIndexJson() {
  try {
    const { blobs } = await list({ prefix: INDEX_BLOB_PATH, limit: 1, token }); // <-- pass token
    if (!blobs || blobs.length === 0) return [];
    const res = await fetch(blobs[0].url);
    return await res.json();
  } catch {
    return [];
  }
}
