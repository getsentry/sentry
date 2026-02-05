/**
 * Finds the longest common prefix shared by all strings in the array.
 */
export function computeCommonPrefix(strings: string[]): string {
  if (strings.length === 0) {
    return '';
  }

  let prefix = strings[0]!;
  for (let i = 1; i < strings.length; i++) {
    const s = strings[i]!;
    let j = 0;
    while (j < prefix.length && j < s.length && prefix[j] === s[j]) {
      j++;
    }
    prefix = prefix.slice(0, j);
    if (prefix === '') {
      return '';
    }
  }

  return prefix;
}

/**
 * Finds the longest common suffix shared by all strings in the array.
 */
export function computeCommonSuffix(strings: string[]): string {
  if (strings.length === 0) {
    return '';
  }

  let suffix = strings[0]!;
  for (let i = 1; i < strings.length; i++) {
    const s = strings[i]!;
    let j = 0;
    while (
      j < suffix.length &&
      j < s.length &&
      suffix[suffix.length - 1 - j] === s[s.length - 1 - j]
    ) {
      j++;
    }
    suffix = suffix.slice(suffix.length - j);
    if (suffix === '') {
      return '';
    }
  }

  return suffix;
}

const MIN_AFFIX_LENGTH = 3;

/**
 * Strips the common prefix (if >3 chars) and suffix (if >3 chars) from a
 * value, replacing each with `…`.
 */
export function trimCommonAffixes(value: string, prefix: string, suffix: string): string {
  let result = value;

  if (prefix.length > MIN_AFFIX_LENGTH) {
    result = `\u2026${result.slice(prefix.length)}`;
  }

  if (suffix.length > MIN_AFFIX_LENGTH) {
    result = `${result.slice(0, result.length - suffix.length)}\u2026`;
  }

  return result;
}
