export function parseKeywords(input: string): string[] {
  return (input || '')
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

export function cleanKeywords(input: string, targetCount: number): string {
  const out: string[] = [];
  const seen = new Set<string>(); // case-insensitive dedupe
  for (const kw of parseKeywords(input)) {
    const k = kw.toLowerCase();
    if (!seen.has(k)) {
      seen.add(k);
      out.push(kw);
      if (out.length >= targetCount) break; // enforce exact count by truncation
    }
  }
  return out.join(', ');
}
