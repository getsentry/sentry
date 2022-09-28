/**
 * Trim slug name with a preference for preserving whole words. Only cut up
 * whole words if the last remaining words are still too long.
 *
 * For example:
 *
 *   javascript-project-backend  -> javascript…backend
 *   my-long-sentry-project-name -> my-long…project-name
 *   javascriptproject-backend   -> javascriptproj…ackend
 */
export function trimSlug(slug: string, maxLength: number = 20) {
  // Return the original slug if it's already shorter than maxLength
  if (slug.length <= maxLength) {
    return slug;
  }

  /**
   * Array of words inside the slug.
   * E.g. "my-project-name" becomes ["my", "project", "name"]
   */
  const words: string[] = slug.split('-');

  // If the string is too long but not hyphenated, return an end-trimmed
  // string. E.g. "javascriptfrontendproject" --> "javascriptfrontendp…"
  if (words.length === 1) {
    return `${slug.slice(0, maxLength - 1)}\u2026`;
  }

  /**
   * Returns the length (total number of letters plus hyphens in between
   * words) of the current words array.
   */
  function getLength(arr: string[]): number {
    return arr.reduce((acc, cur) => acc + cur.length + 1, 0) - 1;
  }

  // Progressively remove words in the middle until we're below maxLength,
  // or when only two words are left
  while (getLength(words) > maxLength && words.length > 2) {
    words.splice(Math.floor(words.length / 2 - 0.5), 1);
  }

  // If the remaining words array satisfies the maxLength requirement,
  // return the trimmed result.
  if (getLength(words) <= maxLength) {
    const divider = Math.floor(words.length / 2);
    return `${words.slice(0, divider).join('-')}\u2026${words.slice(divider).join('-')}`;
  }

  // If the remaining 2 words are still too long, trim those words starting
  // from the middle.
  const debt = getLength(words) - maxLength;
  const toTrimFromLeftWord = Math.ceil(debt / 2);
  const leftWordLength = Math.max(words[0].length - toTrimFromLeftWord, 3);
  const leftWord = words[0].slice(0, leftWordLength);
  const rightWordLength = maxLength - leftWord.length;
  const rightWord = words[1].slice(-rightWordLength);

  return `${leftWord}\u2026${rightWord}`;
}
