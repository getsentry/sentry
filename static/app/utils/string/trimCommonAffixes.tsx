const ELLIPSIS = '\u2026';
const MIN_AFFIX_LENGTH = 3;

/**
 * Computes the lengths of the common prefix and suffix across all strings
 * in a single pass, using the first string as a reference.
 *
 * The algorithm works by iteratively narrowing. It starts by assuming the
 * entire first string is both a common prefix and a common suffix, then
 * compares each subsequent string to shrink those bounds.
 *
 * Example with ['/api/v2/users', '/api/v2/teams', '/api/other']:
 *
 *   Start:       prefixLen = 13 (length of first string)
 *   vs 2nd str:  match '/api/v2/' then 'u' ≠ 't' → prefixLen = 8
 *   vs 3rd str:  match '/api/' then 'v' ≠ 'o'   → prefixLen = 5
 *
 * The suffix works identically but compares from the end inward.
 *
 * Note: prefix and suffix are computed independently — they can overlap
 * (e.g. identical strings have prefixLen = suffixLen = full length).
 * The caller is responsible for handling that case.
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

    // Walk forward comparing characters. Stop at the first mismatch,
    // at the current prefix bound, or at the end of the shorter string.
    let j = 0;
    while (j < prefixLen && j < s.length && first[j] === s[j]) {
      j++;
    }
    prefixLen = j;

    // Walk backward from the end of each string. `k` counts how many
    // characters match from the tail. We index into each string from
    // its own end so strings of different lengths are handled correctly.
    let k = 0;
    while (
      k < suffixLen &&
      k < s.length &&
      first[first.length - 1 - k] === s[s.length - 1 - k]
    ) {
      k++;
    }
    suffixLen = k;

    // If both have been narrowed to zero, no further strings can widen them.
    if (prefixLen === 0 && suffixLen === 0) {
      break;
    }
  }

  return {prefixLen, suffixLen};
}

/**
 * Adjusts raw character-level affix boundaries so they land on a separator
 * boundary instead of cutting mid-segment.
 *
 * Since the prefix region is common to all strings, any separator found in
 * the reference string's prefix region exists at the same position in every
 * string. This means we only need to search the reference.
 *
 * For the prefix, we search backward from the raw boundary to find the last
 * separator, then snap to it (keeping the separator visible in the output):
 *
 *   "/api/v2/pro|jects/frontend"   raw boundary at 11 (|)
 *             ^  last '/' at 7  →  snap to 7 → visible: "/projects/frontend"
 *
 * For the suffix, we search forward from the raw cut point to find the next
 * separator, then snap the suffix start to that position:
 *
 *   "abc/segAx|/shared/tail"   raw cut point at 8 (|), raw suffix = 13
 *              ^  first '/' at 9  →  snap suffix to 12 ("/shared/tail")
 *
 * In both cases, snapping moves the boundary *inward* (trims less), which
 * is conservative — we'd rather keep a full segment than show a fragment.
 *
 * If no separator is found in the search region, the raw boundary is
 * returned unchanged (the strings may not contain the separator at all).
 */
function snapAffixToSeparator(
  reference: string,
  prefixLen: number,
  suffixLen: number,
  separator: string
): {prefixLen: number; suffixLen: number} {
  let snappedPrefix = prefixLen;
  let snappedSuffix = suffixLen;

  if (prefixLen > 0) {
    // Search backward: find the last separator that starts at or before
    // the raw boundary. We use `prefixLen - 1` because lastIndexOf's
    // fromIndex is inclusive and we want separators within the prefix.
    const lastSep = reference.lastIndexOf(separator, prefixLen - 1);
    if (lastSep >= 0) {
      // Snap to the separator position so it remains visible in the
      // output, providing structural context (e.g. `…/projects` instead
      // of `…projects` tells the reader it's a path segment).
      snappedPrefix = lastSep;
    }
  }

  if (suffixLen > 0) {
    // The cut point is where the suffix begins in the original string.
    // Everything from cutPoint onward is the suffix region.
    const cutPoint = reference.length - suffixLen;

    // Search forward: find the first separator at or after the cut point.
    const firstSep = reference.indexOf(separator, cutPoint);
    if (firstSep >= 0) {
      // Snap the suffix to start at the separator, converting the
      // separator's absolute position back to a suffix length.
      snappedSuffix = reference.length - firstSep;
    }
  }

  return {prefixLen: snappedPrefix, suffixLen: snappedSuffix};
}

/**
 * Computes the common prefix and suffix of the given strings, then strips
 * them from each value, replacing each with `…`. Only trims affixes longer
 * than `minAffixLength` (default 3).
 *
 * When `separator` is provided, affix boundaries snap to the nearest
 * separator so trimming never cuts mid-segment.
 *
 * The pipeline is:
 *
 *   1. Compute raw character-level affix lengths
 *   2. (Optional) Snap affix boundaries to the nearest separator
 *   3. Drop any affix that's ≤ minAffixLength (too short to be worth trimming)
 *   4. For each string, replace the prefix/suffix regions with `…`
 *
 * Step 2 happens before step 3 intentionally: snapping can reduce an affix
 * below the threshold, which correctly prevents trimming at a non-useful
 * boundary (e.g. snapping a 7-char raw prefix to a 2-char separator-aligned
 * one means there isn't enough common structure to justify trimming).
 */
export function trimCommonAffixes(
  strings: string[],
  options: {minAffixLength?: number; separator?: string} = {}
): string[] {
  const {minAffixLength = MIN_AFFIX_LENGTH, separator} = options;

  if (strings.length <= 1) {
    return strings;
  }

  // Step 1: character-level common prefix/suffix lengths
  const first = strings[0]!;
  let {prefixLen: rawPrefixLen, suffixLen: rawSuffixLen} =
    computeCommonAffixLengths(strings);

  // Step 2: snap to separator boundaries (may reduce affix lengths)
  if (separator !== undefined && separator.length > 0) {
    const snapped = snapAffixToSeparator(first, rawPrefixLen, rawSuffixLen, separator);
    rawPrefixLen = snapped.prefixLen;
    rawSuffixLen = snapped.suffixLen;
  }

  // Step 3: drop affixes that are too short to justify an ellipsis
  const prefixLen = rawPrefixLen > minAffixLength ? rawPrefixLen : 0;
  const suffixLen = rawSuffixLen > minAffixLength ? rawSuffixLen : 0;

  if (prefixLen === 0 && suffixLen === 0) {
    return strings;
  }

  // Step 4: strip affixes and insert ellipses
  return strings.map(value => {
    // Guard: if the prefix and suffix together consume the entire string
    // (happens with identical or near-identical strings), only trim the
    // prefix to avoid producing an empty or nonsensical result.
    if (prefixLen + suffixLen >= value.length) {
      return prefixLen > 0 ? `${ELLIPSIS}${value.slice(prefixLen)}` : value;
    }

    let result = value;

    // Replace leading common chars with ellipsis:
    //   "/api/v2/users" with prefixLen=8 → "…users"
    if (prefixLen > 0) {
      result = `${ELLIPSIS}${result.slice(prefixLen)}`;
    }

    // Replace trailing common chars with ellipsis.
    // Note: if we prepended an ellipsis above, `result` is now longer by 1
    // (the ellipsis char), but we subtract `suffixLen` from the *current*
    // result length, so the math stays correct.
    //   "users_count" with suffixLen=7 → "user…"
    if (suffixLen > 0) {
      result = `${result.slice(0, result.length - suffixLen)}${ELLIPSIS}`;
    }

    return result;
  });
}
