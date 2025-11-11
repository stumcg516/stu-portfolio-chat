import cosine from "cosine-similarity";

export function topK(queryVec, docs, k = 8, minSim = 0.12) {
  const scored = docs
    .map(d => ({ ...d, score: cosine(queryVec, d.embedding) }))
    .sort((a, b) => b.score - a.score)
    .filter(d => d.score >= minSim)
    .slice(0, k);
  return scored;
}
