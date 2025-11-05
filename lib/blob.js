import { put, list } from "@vercel/blob";

const INDEX_BLOB_PATH = "vector_index.json"; // single file in project root

export async function saveIndexJson(jsonString) {
  const res = await put(INDEX_BLOB_PATH, jsonString, {
    access: "public",
    contentType: "application/json",
  });
  return res.url; // public URL
}

export async function loadIndexJson() {
  try {
    // Find the blob we wrote at this pathname
    const { blobs } = await list({ prefix: INDEX_BLOB_PATH, limit: 1 });
    if (!blobs || blobs.length === 0) return [];
    // blobs[0].url is public; fetch the JSON
    const res = await fetch(blobs[0].url);
    const text = await res.text();
    return JSON.parse(text);
  } catch (e) {
    return [];
  }
}
