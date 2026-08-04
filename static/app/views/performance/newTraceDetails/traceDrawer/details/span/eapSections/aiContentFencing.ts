import {parseJsonWithFix} from 'sentry/views/performance/newTraceDetails/traceDrawer/details/utils';

import {tryParsePythonDict} from './aiContentDetection';
import {isKnownHtmlTag} from './htmlTags';

/**
 * Wraps raw HTML and JSON found in AI content in fenced code blocks, so the
 * markdown renderer highlights them instead of rendering HTML as literal markup
 * or letting markdown mangle JSON.
 *
 * The layer is a list of {@link ContentDetector}s. Adding support for another
 * content type is a matter of appending a detector — see {@link DETECTORS}.
 */

interface DetectedBlock {
  /** Exclusive end offset into the source string. */
  end: number;
  /** Info-string / language hint for the fence (e.g. `json`, `html`). */
  language: string;
  /** Inclusive start offset into the source string. */
  start: number;
}

interface ContentDetector {
  /** Returns every candidate block found in `text`. Overlaps are resolved by the driver. */
  detect: (text: string) => DetectedBlock[];
  name: string;
}

// Matches a single opening or self-closing HTML tag; group 1 is the tag name.
// Closing tags (`</tag>`) don't match because a `/` can't follow `<` here.
const HTML_OPEN_REGEX = /<([a-zA-Z][\w-]*)\b[^>]*>/g;

/** Detects balanced HTML tag pairs whose tag name is a known HTML element. */
const htmlDetector: ContentDetector = {
  name: 'html',
  detect(text) {
    const blocks: DetectedBlock[] = [];
    for (const match of text.matchAll(HTML_OPEN_REGEX)) {
      const tagName = match[1]!;
      // Skip non-HTML tags and self-closing tags, which have no closing pair.
      if (!isKnownHtmlTag(tagName) || match[0].endsWith('/>')) {
        continue;
      }
      const end = findHtmlPairEnd(text, tagName, match.index + match[0].length);
      if (end === -1) {
        continue;
      }
      blocks.push({start: match.index, end, language: 'html'});
    }
    return blocks;
  },
};

/**
 * Given an opening `<tagName>` whose `>` ends at `openEnd`, returns the offset
 * just past the `</tagName>` that closes it, counting nested same-name tags so
 * `<div><div>…</div></div>` pairs correctly. Returns -1 if unbalanced.
 */
function findHtmlPairEnd(text: string, tagName: string, openEnd: number): number {
  // Tag names only ever contain `[a-zA-Z][\w-]*`, so they are regex-safe.
  const tagRegex = new RegExp(`<(/?)${tagName}\\b[^>]*?(/?)>`, 'gi');
  tagRegex.lastIndex = openEnd;
  let depth = 1;
  for (let m = tagRegex.exec(text); m; m = tagRegex.exec(text)) {
    if (m[1] === '/') {
      depth--;
      if (depth === 0) {
        return m.index + m[0].length;
      }
    } else if (m[2] !== '/') {
      depth++; // nested opening tag of the same name
    }
  }
  return -1;
}

/** Detects balanced `{...}` / `[...]` runs that parse as a non-trivial object or array. */
const jsonDetector: ContentDetector = {
  name: 'json',
  detect(text) {
    const blocks: DetectedBlock[] = [];
    for (let i = 0; i < text.length; i++) {
      if (text[i] !== '{' && text[i] !== '[') {
        continue;
      }
      const end = findBalancedEnd(text, i);
      if (end === -1) {
        continue;
      }
      // Only fence runs that stand on their own; skip JSON glued to other text
      // (e.g. `key={"a":1}` or `arr[0]`) which is part of an expression.
      if (
        hasStandaloneBoundary(text, i, end + 1) &&
        looksLikeJson(text.slice(i, end + 1))
      ) {
        blocks.push({start: i, end: end + 1, language: 'json'});
        i = end; // skip past this block so nested braces aren't re-detected
      }
    }
    return blocks;
  },
};

const DETECTORS: readonly ContentDetector[] = [htmlDetector, jsonDetector];

/**
 * Returns `text` with any detected HTML/JSON runs wrapped in fenced code
 * blocks. Content already inside fenced or inline code is left untouched.
 */
export function fenceContent(
  text: string,
  detectors: readonly ContentDetector[] = DETECTORS
): string {
  const protectedRanges = getProtectedRanges(text);
  const overlapsProtected = (start: number, end: number) =>
    protectedRanges.some(r => start < r.end && end > r.start);

  const candidates = detectors
    .flatMap(detector => detector.detect(text))
    .filter(block => !overlapsProtected(block.start, block.end))
    // Earliest first; on a tie prefer the longer block.
    .sort((a, b) => a.start - b.start || b.end - a.end);

  // Greedily keep non-overlapping blocks (first match wins).
  const chosen: DetectedBlock[] = [];
  let lastEnd = -1;
  for (const block of candidates) {
    if (block.start >= lastEnd) {
      chosen.push(block);
      lastEnd = block.end;
    }
  }

  // Apply edits back-to-front so earlier offsets stay valid.
  let result = text;
  for (let i = chosen.length - 1; i >= 0; i--) {
    const {start, end, language} = chosen[i]!;
    const raw = text.slice(start, end);
    // A fenced block is block-level and would split surrounding prose. When the
    // run sits inline (text on the same line), keep it inline with inline code.
    const replacement = isInlinePosition(text, start, end)
      ? wrapInlineCode(raw)
      : wrapInFence(raw, language);
    result = result.slice(0, start) + replacement + result.slice(end);
  }
  return result;
}

/** Whether a detected run is single-line and has prose beside it on that line. */
function isInlinePosition(text: string, start: number, end: number): boolean {
  if (text.slice(start, end).includes('\n')) {
    return false; // multi-line runs are inherently block-level
  }
  const lineStart = text.lastIndexOf('\n', start - 1) + 1;
  const nextNewline = text.indexOf('\n', end);
  const before = text.slice(lineStart, start);
  const after = text.slice(end, nextNewline === -1 ? text.length : nextNewline);
  return before.trim() !== '' || after.trim() !== '';
}

/** Offset ranges already inside fenced or inline code, which must not be re-fenced. */
function getProtectedRanges(text: string): Array<{end: number; start: number}> {
  const ranges: Array<{end: number; start: number}> = [];
  const patterns = [/```[\s\S]*?```/g, /~~~[\s\S]*?~~~/g, /(`+)[^`]*\1/g];
  for (const pattern of patterns) {
    for (const match of text.matchAll(pattern)) {
      ranges.push({start: match.index, end: match.index + match[0].length});
    }
  }
  return ranges;
}

/**
 * Returns the offset of the bracket that closes the one at `start`, or -1 if
 * unbalanced. Tracks string state so brackets inside strings don't count. Both
 * quote styles are handled since JSON uses `"` and Python-repr dicts use `'`.
 */
function findBalancedEnd(text: string, start: number): number {
  let depth = 0;
  let stringChar: '"' | "'" | null = null;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (stringChar !== null) {
      if (ch === '\\') {
        i++; // skip escaped char
      } else if (ch === stringChar) {
        stringChar = null;
      }
      continue;
    }
    if (ch === '"' || ch === "'") {
      stringChar = ch;
    } else if (ch === '{' || ch === '[') {
      depth++;
    } else if (ch === '}' || ch === ']') {
      depth--;
      if (depth === 0) {
        return i;
      }
    }
  }
  return -1;
}

// Trailing punctuation that can legitimately follow standalone JSON in prose,
// e.g. a sentence-ending period or a comma in a list. The leading side stays
// strict so expression glue like `arr[0]` and `key={…}` is still rejected.
const TRAILING_PUNCTUATION = /[.,;:!?)]/;

/**
 * Whether the run at [start, end) stands on its own: preceded by whitespace or
 * the string start, and followed by whitespace, the string end, or trailing
 * sentence punctuation.
 */
function hasStandaloneBoundary(text: string, start: number, end: number): boolean {
  const beforeOk = start === 0 || /\s/.test(text[start - 1]!);
  const afterOk =
    end === text.length || /\s/.test(text[end]!) || TRAILING_PUNCTUATION.test(text[end]!);
  return beforeOk && afterOk;
}

function looksLikeJson(candidate: string): boolean {
  const trimmed = candidate.trim();
  try {
    if (isNonTrivial(JSON.parse(trimmed))) {
      return true;
    }
  } catch {
    // fall through to the lenient parsers
  }
  const {parsed, fixedInvalidJson} = parseJsonWithFix(trimmed);
  if (fixedInvalidJson && isNonTrivial(parsed)) {
    return true;
  }
  // Also accept Python-repr dicts (single quotes, True/False/None).
  const pythonDict = tryParsePythonDict(trimmed);
  return pythonDict !== null && isNonTrivial(pythonDict);
}

/** Guards against fencing noise like `{}`, `[]`, or a bare `{word}`. */
function isNonTrivial(value: unknown): boolean {
  if (Array.isArray(value)) {
    return value.length > 0;
  }
  return typeof value === 'object' && value !== null && Object.keys(value).length > 0;
}

function wrapInFence(raw: string, language: string): string {
  const fence = '`'.repeat(Math.max(3, longestBacktickRun(raw) + 1));
  return `\n\n${fence}${language}\n${raw.trim()}\n${fence}\n\n`;
}

function wrapInlineCode(raw: string): string {
  const trimmed = raw.trim();
  const ticks = '`'.repeat(longestBacktickRun(trimmed) + 1);
  // Pad with spaces when content starts/ends with a backtick (CommonMark rule).
  const pad = trimmed.startsWith('`') || trimmed.endsWith('`') ? ' ' : '';
  return `${ticks}${pad}${trimmed}${pad}${ticks}`;
}

function longestBacktickRun(text: string): number {
  let max = 0;
  let current = 0;
  for (const ch of text) {
    if (ch === '`') {
      current++;
      max = Math.max(max, current);
    } else {
      current = 0;
    }
  }
  return max;
}
