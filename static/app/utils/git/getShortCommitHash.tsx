export function getShortCommitHash(hash: string): string {
  if (hash.match(/^[\da-f]{40}$/)) {
    hash = hash.substring(0, 7);
  }
  return hash;
}
