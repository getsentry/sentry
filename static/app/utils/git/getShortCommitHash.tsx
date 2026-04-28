export function getShortCommitHash(hash: string): string {
  if (/^[a-f0-9]{40}$/.test(hash)) {
    hash = hash.substring(0, 7);
  }
  return hash;
}
