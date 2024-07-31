export function getShortCommitHash(hash: string): string {
  if (hash.match(/^[a-f0-9]{40}$/)) {
    hash = hash.substring(0, 7);
  }
  return hash;
}
