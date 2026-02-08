const ELLIPSIS = '\u2026';
const MIN_AFFIX_LENGTH = 3;

/**
 * Computes the lengths of the common prefix and suffix in a single pass.
 */
function computeCommonAffixLengths(strings: string[]): {
  prefixLen: number;
  suffixLen: number;
} {
  if (strings.length === 0) {
    return {prefixLen: 0, suffixLen: 0};
  }

  const first = strings[0]!;
  let prefixLen = first.length;
  let suffixLen = first.length;

  for (let i = 1; i < strings.length; i++) {
    const s = strings[i]!;

    // Narrow prefix
    let j = 0;
    while (j < prefixLen && j < s.length && first[j] === s[j]) {
      j++;
    }
    prefixLen = j;

    // Narrow suffix
    let k = 0;
    while (
      k < suffixLen &&
      k < s.length &&
      first[first.length - 1 - k] === s[s.length - 1 - k]
    ) {
      k++;
    }
    suffixLen = k;

    if (prefixLen === 0 && suffixLen === 0) {
      break;
    }
  }

  return {prefixLen, suffixLen};
}

/**
 * Computes the common prefix and suffix of the given strings, then strips
 * them from each value, replacing each with `…`. Only trims affixes longer
 * than `minAffixLength` (default 3).
 */
export function trimCommonAffixes(
  strings: string[],
  minAffixLength: number = MIN_AFFIX_LENGTH
): string[] {
  // Common affixes only make sense with 2+ strings
  if (strings.length <= 1) {
    return strings;
  }

  const {prefixLen: rawPrefixLen, suffixLen: rawSuffixLen} =
    computeCommonAffixLengths(strings);

  const prefixLen = rawPrefixLen > minAffixLength ? rawPrefixLen : 0;
  const suffixLen = rawSuffixLen > minAffixLength ? rawSuffixLen : 0;

  if (prefixLen === 0 && suffixLen === 0) {
    return strings;
  }

  return strings.map(value => {
    // If prefix and suffix overlap or consume the entire string, only trim the prefix
    if (prefixLen + suffixLen >= value.length) {
      return prefixLen > 0 ? `${ELLIPSIS}${value.slice(prefixLen)}` : value;
    }

    let result = value;

    if (prefixLen > 0) {
      result = `${ELLIPSIS}${result.slice(prefixLen)}`;
    }

    if (suffixLen > 0) {
      result = `${result.slice(0, result.length - suffixLen)}${ELLIPSIS}`;
    }

    return result;
  });
}
