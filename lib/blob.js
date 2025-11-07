// lib/blob.js
import { put, list } from "@vercel/blob";

const INDEX_FILENAME = "vector_index.json";
const token = process.env.BLOB_READ_WRITE_TOKEN;

/**
 * Save the latest vector index to Vercel Blob.
 * Always overwrites the same file name ("vector_index.json").
 */
export async function saveIndexJson(jsonString) {
  const res = await put(INDEX_FILENAME, jsonString, {
    access: "public",
    contentType: "application/json",
    token,
  });
  return res.url;
}

/**
 * Load the most recent vector index from Vercel Blob.
 * Includes a cache-buster to ensure the freshest version is fetched.
 */
export async function loadIndexJson() {
  // List all blobs and find the target index file
  const { blobs = [] } = await list({ token, limit: 100 });
  const target =
    blobs.find((b) => b.pathname === INDEX_FILENAME) ||
    blobs.find((b) => b.pathname.endsWith(INDEX_FILENAME));

  if (!target) return [];

  // Add cache-buster + disable CDN caching
  const res = await fetch(`${target.url}?_=${Date.now()}`, {
    cache: "no-store",
    next: { revalidate: 0 },
  });

  if (!res.ok) return [];
  return await res.json();
}
