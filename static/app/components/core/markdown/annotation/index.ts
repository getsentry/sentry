import type {TokenizerAndRendererExtension, Tokens} from 'marked'; // eslint-disable-line no-restricted-imports

import {escape} from 'sentry/utils';

/**
 * Annotations attach data to a span of text with characters that survive parsing
 * the text, like JSON, and never show up in it: an opening mark, the data, a
 * separator, the annotated text, and a closing mark. The marks are Unicode
 * noncharacters, which are reserved for internal use and never appear in real
 * text, unlike the private use area, where icon fonts live. The data is shifted
 * into the private use area, but is only read between an opening mark and a
 * separator.
 */
const OPEN = '\uFDD0';
const SEPARATOR = '\uFDD1';
const CLOSE = '\uFDD2';
const DATA_OFFSET = 0xe100;

const ANNOTATION_RE = /^\uFDD0([\uE100-\uE17F]*)\uFDD1([^\uFDD0-\uFDD2]*)\uFDD2/;
// Also matches the marks of an annotation that was cut, like a missing separator.
const MARKS_RE = /\uFDD0[\uE100-\uE17F]*\uFDD1?|[\uFDD1\uFDD2]/g;
const ANY_MARK_RE = /[\uFDD0-\uFDD2]/;

export interface AnnotationToken {
  data: string;
  raw: string;
  text: string;
  type: 'annotation';
}

export type AnnotationSegment = string | {data: string; text: string};

export function annotate(text: string, data: string): string {
  // Percent-encoding keeps the data within the shifted ASCII range.
  const encoded = Array.from(encodeURIComponent(data), char =>
    String.fromCharCode(DATA_OFFSET + char.charCodeAt(0))
  ).join('');
  return `${OPEN}${encoded}${SEPARATOR}${text}${CLOSE}`;
}

export function hasAnnotations(text: string): boolean {
  return ANY_MARK_RE.test(text);
}

export function stripAnnotations(text: string): string {
  return hasAnnotations(text) ? text.replace(MARKS_RE, '') : text;
}

/**
 * Truncates text to `maxLength` visible characters without cutting through the
 * annotation marks.
 */
export function truncateAnnotated(text: string, maxLength: number): string {
  if (stripAnnotations(text).length <= maxLength) {
    return text;
  }
  let remaining = maxLength;
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
  return truncated;
}

export function splitAnnotations(text: string): AnnotationSegment[] {
  const segments: AnnotationSegment[] = [];
  let rest = text;
  while (rest) {
    const start = rest.indexOf(OPEN);
    if (start === -1) {
      segments.push(stripAnnotations(rest));
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
    return escape(String(token.text));
  },
};
