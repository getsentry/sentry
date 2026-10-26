export function ensureSentenceEnd(sentence: string) {
  const trimmed = sentence.trim();
  return /[.!?…]["'”’)]*$/.test(trimmed) ? trimmed : `${trimmed}.`;
}
