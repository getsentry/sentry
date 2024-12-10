export function dedupeArray(values: string[]): string[] {
  const deduped: string[] = [];
  const seen = new Set();
  values.forEach(s => {
    if (seen.has(s)) {
      return;
    }

    seen.add(s);
    deduped.push(s);
  });
  return deduped;
}
