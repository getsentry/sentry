import type {TokenizerAndRendererExtension, Tokens} from 'marked'; // eslint-disable-line no-restricted-imports

/**
 * Annotations attach data to a span of text with characters from Unicode's private
 * use area, so they survive parsing the text, like JSON, and never show up in it:
 * an opening mark, the data (each character shifted into the private use area), a
 * separator, the annotated text, and a closing mark.
 */
const OPEN = '\uE000';
const SEPARATOR = '\uE001';
const CLOSE = '\uE002';
const DATA_OFFSET = 0xe100;

const ANNOTATION_RE = /^\uE000([\uE100-\uE17F]*)\uE001([^\uE000-\uE002]*)\uE002/;
const MARKS_RE = /\uE000[\uE100-\uE17F]*\uE001|\uE002/g;

export interface AnnotationToken {
  data: string;
  raw: string;
  text: string;
  type: 'annotation';
}

export type AnnotationSegment = string | {data: string; text: string};

/** Annotates `text` with `data`. */
export function annotate(text: string, data: string): string {
  // Percent-encoding keeps the data within the shifted ASCII range.
  const encoded = Array.from(encodeURIComponent(data), char =>
    String.fromCharCode(DATA_OFFSET + char.charCodeAt(0))
  ).join('');
  return `${OPEN}${encoded}${SEPARATOR}${text}${CLOSE}`;
}

export function hasAnnotations(text: string): boolean {
  return text.includes(OPEN);
}

/** Removes the annotation marks, keeping the annotated text. */
export function stripAnnotations(text: string): string {
  return hasAnnotations(text) ? text.replace(MARKS_RE, '') : text;
}

/**
 * Truncates text to `maxLength` visible characters, ending in an ellipsis, without
 * cutting through the annotation marks.
 */
export function truncateAnnotated(text: string, maxLength: number): string {
  if (stripAnnotations(text).length <= maxLength) {
    return text;
  }
  const ellipsis = '...';
  let remaining = Math.max(0, maxLength - ellipsis.length);
  let truncated = '';
  for (const segment of splitAnnotations(text)) {
    if (remaining <= 0) {
      break;
    }
    const kept = (typeof segment === 'string' ? segment : segment.text).slice(
      0,
      remaining
    );
    truncated += typeof segment === 'string' ? kept : annotate(kept, segment.data);
    remaining -= kept.length;
  }
  return truncated + ellipsis;
}

/** Splits text into plain strings and annotated spans, in order. */
export function splitAnnotations(text: string): AnnotationSegment[] {
  const segments: AnnotationSegment[] = [];
  let rest = text;
  while (rest) {
    const start = rest.indexOf(OPEN);
    if (start === -1) {
      segments.push(rest);
      break;
    }
    const match = ANNOTATION_RE.exec(rest.slice(start));
    if (!match) {
      // A stray mark, so the rest isn't annotated.
      segments.push(stripAnnotations(rest));
      break;
    }
    if (start > 0) {
      segments.push(rest.slice(0, start));
    }
    const [raw, data = '', annotated = ''] = match;
    segments.push({data: decode(data), text: annotated});
    rest = rest.slice(start + raw.length);
  }
  return segments;
}

function decode(encoded: string): string {
  const percentEncoded = Array.from(encoded, char =>
    String.fromCharCode(char.charCodeAt(0) - DATA_OFFSET)
  ).join('');
  try {
    return decodeURIComponent(percentEncoded);
  } catch {
    return '';
  }
}

export const annotationExtension: TokenizerAndRendererExtension = {
  name: 'annotation',
  level: 'inline',
  start(src: string): number | undefined {
    const idx = src.indexOf(OPEN);
    return idx === -1 ? undefined : idx;
  },
  tokenizer(src: string): Tokens.Generic | undefined {
    const match = ANNOTATION_RE.exec(src);
    if (!match) {
      return undefined;
    }
    const [raw, data = '', text = ''] = match;
    return {type: 'annotation', raw, data: decode(data), text};
  },
  // Rendering to HTML keeps just the text.
  renderer(token: Tokens.Generic): string {
    return escapeHtml(String(token.text));
  },
};

function escapeHtml(text: string): string {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}
