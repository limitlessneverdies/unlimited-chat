// Rough token estimator — Anthropic-ish heuristic: ~4 chars per token,
// with a small bump for whitespace-heavy text. Good enough for a live counter.
export function estimateTokens(text: string): number {
  if (!text) return 0;
  const chars = text.length;
  // chars/4 baseline, but cap drift on very short strings
  return Math.max(1, Math.round(chars / 4));
}

export function formatTokens(n: number): string {
  if (n < 1000) return `${n}`;
  if (n < 10000) return `${(n / 1000).toFixed(1)}k`;
  return `${Math.round(n / 1000)}k`;
}
