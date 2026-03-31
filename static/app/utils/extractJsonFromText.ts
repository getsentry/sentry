type TextSegment = {type: 'text'; value: string};
type JsonSegment = {type: 'json'; value: string};

export type ExtractedSegment = TextSegment | JsonSegment;

/**
 * Finds the position of the matching closing bracket for a `{` or `[`
 * at position `start`. Correctly handles JSON string literals — bracket
 * characters inside double-quoted strings are ignored, and backslash
 * escapes within strings are respected.
 *
 * Returns the index of the matching closing bracket, or -1 if the
 * brackets are unbalanced.
 */
export function findMatchingBracket(text: string, start: number): number {
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = start; i < text.length; i++) {
    const ch = text[i];

    if (escaped) {
      escaped = false;
      continue;
    }

    if (ch === '\\' && inString) {
      escaped = true;
      continue;
    }

    if (ch === '"') {
      inString = !inString;
      continue;
    }

    if (inString) {
      continue;
    }

    if (ch === '{' || ch === '[') {
      depth++;
    }
    if (ch === '}' || ch === ']') {
      depth--;
    }

    if (depth === 0) {
      return i;
    }
  }

  return -1;
}

/**
 * Extracts JSON object and array substrings from arbitrary text.
 *
 * Scans `text` for `{` / `[` characters, uses string-aware bracket
 * matching to find the candidate closing bracket, then validates the
 * candidate with `JSON.parse`. Returns an array of segments preserving
 * the full original text — every character appears in exactly one
 * segment, and concatenating all segment values reproduces the input.
 *
 * Only objects and arrays are recognized as JSON segments; bare
 * primitives like `"hello"`, `42`, or `true` are left as text.
 *
 * @example
 *   extractJsonFromText('msg: {"level":"info"} ok')
 *   // [
 *   //   { type: 'text', value: 'msg: ' },
 *   //   { type: 'json', value: '{"level":"info"}' },
 *   //   { type: 'text', value: ' ok' },
 *   // ]
 */
export function extractJsonFromText(text: string): ExtractedSegment[] {
  const segments: ExtractedSegment[] = [];
  let i = 0;

  while (i < text.length) {
    let nextStart = -1;
    for (let j = i; j < text.length; j++) {
      if (text[j] === '{' || text[j] === '[') {
        nextStart = j;
        break;
      }
    }

    if (nextStart === -1) {
      if (i < text.length) {
        segments.push({type: 'text', value: text.slice(i)});
      }
      break;
    }

    if (nextStart > i) {
      segments.push({type: 'text', value: text.slice(i, nextStart)});
    }

    const matchEnd = findMatchingBracket(text, nextStart);
    if (matchEnd === -1) {
      segments.push({type: 'text', value: text.slice(nextStart)});
      break;
    }

    const candidate = text.slice(nextStart, matchEnd + 1);
    try {
      const parsed = JSON.parse(candidate);
      if (typeof parsed === 'object' && parsed !== null) {
        segments.push({type: 'json', value: candidate});
        i = matchEnd + 1;
      } else {
        segments.push({type: 'text', value: text[nextStart]!});
        i = nextStart + 1;
      }
    } catch {
      segments.push({type: 'text', value: text[nextStart]!});
      i = nextStart + 1;
    }
  }

  // Merge consecutive text segments produced when invalid candidates
  // cause the scanner to advance one character at a time.
  const merged: ExtractedSegment[] = [];
  for (const segment of segments) {
    const last = merged[merged.length - 1];
    if (segment.type === 'text' && last?.type === 'text') {
      last.value += segment.value;
    } else {
      merged.push(segment);
    }
  }

  return merged;
}
