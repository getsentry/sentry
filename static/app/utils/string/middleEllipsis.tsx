/**
 * Trim strings with a preference for preserving whole words. Only cut up
 * whole words if the last remaining words are still too long.
 *
 * @param value The string to trim
 * @param maxLength The maximum length of the string
 * @param delimiter The delimiter to split the string by. If passing a regex be aware that the algorithm only supports single-character delimiters.
 *
 * **Examples:**
 *
 * - javascript project backend  -> javascript…backend
 * - my long sentry project name -> my long…project name
 * - javascriptproject backend   -> javascriptproj…ackend
 */
export function middleEllipsis(
  value: string,
  maxLength: number,
  delimiter: string | RegExp = ' '
) {
  // Return the original slug if it's already shorter than maxLength
  if (value.length <= maxLength) {
    return value;
  }

  /**
   * Array of words inside the string.
   * E.g. "my project name" becomes ["my", "project", "name"]
   */
  const words: string[] = value.split(delimiter);
  const delimiters = Array.from(value.match(new RegExp(delimiter, 'g')) || []);

  // If the string is too long but not hyphenated, return an end-trimmed
  // string. E.g. "javascriptfrontendproject" --> "javascriptfrontendp…"
  if (words.length === 1) {
    return `${value.slice(0, maxLength - 1)}\u2026`;
  }

  /**
   * Returns the length (total number of letters plus hyphens in between
   * words) of the current words array.
   */
  function getLength(arr: string[]): number {
    return arr.reduce((acc, cur) => acc + cur.length + 1, 0) - 1;
  }

  // Progressively remove words and delimiters in the middle until we're below maxLength,
  // or when only two words are left
  while (getLength(words) > maxLength && words.length > 2) {
    words.splice(Math.floor(words.length / 2 - 0.5), 1);
  }

  // If the remaining words array satisfies the maxLength requirement,
  // return the trimmed result.
  if (getLength(words) <= maxLength) {
    const divider = Math.floor(words.length / 2);
    const firstHalf = words.slice(0, divider);
    const firstHalfWithDelimiters = firstHalf.flatMap((word, i) =>
      i === divider - 1 ? [word] : [word, delimiters[i]]
    );

    const secondHalf = words.slice(divider);
    const secondHalfWithDelimiters = secondHalf.flatMap((word, i) =>
      i === 0 ? [word] : [delimiters[delimiters.length - secondHalf.length + i], word]
    );

    return `${firstHalfWithDelimiters.join('')}\u2026${secondHalfWithDelimiters.join(
      ''
    )}`;
  }

  // If the remaining 2 words are still too long, trim those words starting
  // from the middle.
  const debt = getLength(words) - maxLength;
  const toTrimFromLeftWord = Math.ceil(debt / 2);
  const leftWordLength = Math.max(words[0]!.length - toTrimFromLeftWord, 3);
  const leftWord = words[0]!.slice(0, leftWordLength);
  const rightWordLength = maxLength - leftWord.length;
  const rightWord = words[1]!.slice(-rightWordLength);

  return `${leftWord}\u2026${rightWord}`;
}
