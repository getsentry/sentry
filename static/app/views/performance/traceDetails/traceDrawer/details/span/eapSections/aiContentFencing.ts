import {parseJsonWithFix} from 'sentry/views/performance/traceDetails/traceDrawer/details/utils';

import {tryParsePythonDict} from './aiContentDetection';
import {isKnownHtmlTag} from './htmlTags';

/**
 * Wraps raw HTML, JSON, and diffs found in AI content in fenced code blocks, so
 * the markdown renderer highlights them instead of rendering HTML as literal
 * markup or letting markdown mangle JSON and diff lines into lists.
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

interface Line {
  /** Exclusive end offset into the source string, before the line break. */
  end: number;
  /** Inclusive start offset into the source string. */
  start: number;
  /** Line content without the line break. */
  text: string;
}

interface ConsumedLines {
  /** Whether any consumed line is an addition, removal, or change. */
  changed: boolean;
  /** Exclusive line index where consumption stopped. */
  end: number;
}

/** Returns the line index just past a diff starting at `start`, or -1. */
type DiffMatcher = (lines: Line[], start: number) => number;

const GIT_DIFF_HEADER = /^diff --git /;
// Extended header lines plus the `Binary files … differ` notice, which sit
// between `diff --git` and the file's hunks.
const GIT_FILE_METADATA =
  /^(index |old mode |new mode |deleted file mode |new file mode |similarity index |dissimilarity index |rename from |rename to |copy from |copy to |Binary files )/;
// Also matches the count-less `@@` / `@@ context` headers that models often emit.
const HUNK_HEADER = /^@@(?:\s|$)/;
// Line counts default to 1 when omitted, e.g. `@@ -3 +3 @@`.
const HUNK_HEADER_COUNTS = /^@@ -\d+(?:,(\d+))? \+\d+(?:,(\d+))? @@/;
const MARKDOWN_LIST_ITEM = /^[-+] \S/;

const CONTEXT_HUNK_SEPARATOR = /^\*{15}$/;
const CONTEXT_OLD_RANGE = /^\*\*\* (\d+)(?:,(\d+))? \*\*\*\*$/;
const CONTEXT_NEW_RANGE = /^--- (\d+)(?:,(\d+))? ----$/;
const CONTEXT_BODY_LINE = /^[ +\-!] /;

/**
 * Detects unified diffs (incl. git headers), context diffs, and OpenAI-style
 * `*** Begin Patch` / `*** End Patch` patches.
 */
const diffDetector: ContentDetector = {
  name: 'diff',
  detect(text) {
    const lines = splitLines(text);
    const blocks: DetectedBlock[] = [];
    for (let i = 0; i < lines.length; i++) {
      let end = matchDiff(lines, i);
      if (end === -1) {
        continue;
      }
      while (end > i && lines[end - 1]!.text.trim() === '') {
        end--;
      }
      blocks.push({start: lines[i]!.start, end: lines[end - 1]!.end, language: 'diff'});
      i = end - 1;
    }
    return blocks;
  },
};

function matchDiff(lines: Line[], start: number): number {
  for (const match of DIFF_MATCHERS) {
    const end = match(lines, start);
    if (end !== -1) {
      return end;
    }
  }
  return -1;
}

function splitLines(text: string): Line[] {
  const lines: Line[] = [];
  let start = 0;
  for (const raw of text.split('\n')) {
    lines.push({start, end: start + raw.length, text: raw.replace(/\r$/, '')});
    start += raw.length + 1;
  }
  return lines;
}

/** Line text at `index`, or an empty string past the end. */
function textAt(lines: Line[], index: number): string {
  return lines[index]?.text ?? '';
}

function matchApplyPatch(lines: Line[], start: number): number {
  if (textAt(lines, start).trimEnd() !== '*** Begin Patch') {
    return -1;
  }
  for (let i = start + 1; i < lines.length; i++) {
    if (lines[i]!.text.trimEnd() === '*** End Patch') {
      return i + 1;
    }
  }
  return -1;
}

/**
 * Matches one or more files of a unified diff. A block may start at a git
 * header, a `---`/`+++` file header pair, or directly at a hunk header.
 */
function matchUnifiedDiff(lines: Line[], start: number): number {
  let i = start;
  let changed = false;
  while (i < lines.length) {
    const fileStart = i;
    if (GIT_DIFF_HEADER.test(textAt(lines, i))) {
      i++;
      while (GIT_FILE_METADATA.test(textAt(lines, i))) {
        i++;
      }
    }
    if (startsUnifiedFileHeader(lines, i)) {
      i += 2;
    }
    while (HUNK_HEADER.test(textAt(lines, i))) {
      const hunk = consumeUnifiedHunk(lines, i);
      changed ||= hunk.changed;
      i = hunk.end;
    }
    if (i === fileStart) {
      break;
    }
  }
  return changed ? i : -1;
}

function startsUnifiedFileHeader(lines: Line[], index: number): boolean {
  return (
    textAt(lines, index).startsWith('--- ') && textAt(lines, index + 1).startsWith('+++ ')
  );
}

/**
 * Consumes the body of the hunk whose header is at `headerIndex`. The header's
 * line counts decide where the hunk ends; once they are used up (or absent),
 * lines are still consumed while they look like hunk body lines rather than a
 * markdown list item, since models frequently get the counts wrong.
 */
function consumeUnifiedHunk(lines: Line[], headerIndex: number): ConsumedLines {
  const counts = HUNK_HEADER_COUNTS.exec(textAt(lines, headerIndex));
  let oldLinesLeft = counts ? Number(counts[1] ?? 1) : 0;
  let newLinesLeft = counts ? Number(counts[2] ?? 1) : 0;
  let changed = false;
  let i = headerIndex + 1;
  for (; i < lines.length; i++) {
    const withinCounts = oldLinesLeft > 0 || newLinesLeft > 0;
    if (!withinCounts && !continuesHunk(lines, i)) {
      break;
    }
    // Models often strip the leading space off empty context lines.
    const marker = lines[i]!.text[0] ?? ' ';
    if (marker === ' ') {
      oldLinesLeft--;
      newLinesLeft--;
    } else if (marker === '-') {
      oldLinesLeft--;
      changed = true;
    } else if (marker === '+') {
      newLinesLeft--;
      changed = true;
    } else if (marker !== '\\') {
      break;
    }
  }
  return {changed, end: i};
}

/**
 * Whether the line at `index`, past a hunk's counts, is more hunk body rather
 * than prose. A blank line counts as body only when more body follows it.
 */
function continuesHunk(lines: Line[], index: number): boolean {
  const line = textAt(lines, index);
  if (line === '') {
    return textAt(lines, index + 1) !== '' && continuesHunk(lines, index + 1);
  }
  return (
    /^[ +\-\\]/.test(line) &&
    !MARKDOWN_LIST_ITEM.test(line) &&
    !startsUnifiedFileHeader(lines, index)
  );
}

/** Matches one or more files of a context diff (`diff -c`). */
function matchContextDiff(lines: Line[], start: number): number {
  let i = start;
  let changed = false;
  while (startsContextFileHeader(lines, i)) {
    i += 2;
    while (CONTEXT_HUNK_SEPARATOR.test(textAt(lines, i))) {
      const oldRange = CONTEXT_OLD_RANGE.exec(textAt(lines, i + 1));
      if (!oldRange) {
        break;
      }
      const oldSection = consumeContextSection(
        lines,
        i + 2,
        contextRangeLength(oldRange)
      );
      i = oldSection.end;
      changed ||= oldSection.changed;
      const newRange = CONTEXT_NEW_RANGE.exec(textAt(lines, i));
      if (newRange) {
        const newSection = consumeContextSection(
          lines,
          i + 1,
          contextRangeLength(newRange)
        );
        i = newSection.end;
        changed ||= newSection.changed;
      }
    }
  }
  return changed ? i : -1;
}

function startsContextFileHeader(lines: Line[], index: number): boolean {
  return (
    textAt(lines, index).startsWith('*** ') &&
    textAt(lines, index + 1).startsWith('--- ') &&
    CONTEXT_HUNK_SEPARATOR.test(textAt(lines, index + 2))
  );
}

function contextRangeLength(range: RegExpExecArray): number {
  const first = Number(range[1]);
  if (range[2] === undefined) {
    return first === 0 ? 0 : 1;
  }
  return Number(range[2]) - first + 1;
}

/**
 * Consumes up to `maxLines` body lines of one side of a context hunk. A side
 * without changes is omitted entirely, so this stops early at the next header.
 * `\ No newline at end of file` markers are consumed without counting as body.
 */
function consumeContextSection(
  lines: Line[],
  start: number,
  maxLines: number
): ConsumedLines {
  let changed = false;
  let bodyLines = 0;
  let i = start;
  for (; i < lines.length; i++) {
    const line = lines[i]!.text;
    if (line.startsWith('\\')) {
      continue;
    }
    if (bodyLines === maxLines || (line !== '' && !CONTEXT_BODY_LINE.test(line))) {
      break;
    }
    bodyLines++;
    changed ||= /^[+\-!]/.test(line);
  }
  return {changed, end: i};
}

const DIFF_MATCHERS: readonly DiffMatcher[] = [
  matchApplyPatch,
  matchUnifiedDiff,
  matchContextDiff,
];

const DETECTORS: readonly ContentDetector[] = [htmlDetector, jsonDetector, diffDetector];

/**
 * Returns `text` with any detected HTML/JSON/diff runs wrapped in fenced code
 * blocks. Content already inside fenced or inline code is left untouched.
 */
export function fenceContent(text: string): string {
  const protectedRanges = getProtectedRanges(text);
  // Code fully inside a block (e.g. `x` on a diff line) becomes literal text
  // once the block is fenced; a partial overlap would break the existing code.
  const straddlesProtected = (start: number, end: number) =>
    protectedRanges.some(r => {
      const overlaps = start < r.end && end > r.start;
      const containsRange = start <= r.start && r.end <= end;
      return overlaps && !containsRange;
    });

  const candidates = DETECTORS.flatMap(detector => detector.detect(text))
    .filter(block => !straddlesProtected(block.start, block.end))
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
  // Inline code spans end at a blank line, like a markdown paragraph.
  const patterns = [
    /```[\s\S]*?```/g,
    /~~~[\s\S]*?~~~/g,
    /(`+)(?:[^`\n]|\n(?![ \t\r]*\n))*\1/g,
  ];
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
