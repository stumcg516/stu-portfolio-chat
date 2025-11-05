import { put, get } from "@vercel/blob";

const INDEX_BLOB_PATH = "vector_index.json"; // single file in project root

export async function saveIndexJson(jsonString) {
  const res = await put(INDEX_BLOB_PATH, jsonString, {
    access: "public",
    contentType: "application/json"
  });
  return res.url;
}

export async function loadIndexJson() {
  try {
    const res = await get(INDEX_BLOB_PATH);
    const text = await res.blob.text();
    return JSON.parse(text);
  } catch {
    return [];
  }
}
