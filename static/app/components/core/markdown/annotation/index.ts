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
const STRAY_MARK_RE = /^(?:\uFDD0[\uE100-\uE17F]*\uFDD1?|[\uFDD1\uFDD2])/;
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
  // Plain text between annotations, which can hold the marks of one that was cut.
  let plain = '';
  let rest = text;
  while (rest) {
    const start = rest.indexOf(OPEN);
    if (start === -1) {
      plain += rest;
      break;
    }
    plain += rest.slice(0, start);
    rest = rest.slice(start);
    const match = ANNOTATION_RE.exec(rest);
    if (match) {
      if (plain) {
        segments.push(stripAnnotations(plain));
        plain = '';
      }
      const [raw, data = '', annotated = ''] = match;
      segments.push({data: decode(data), text: annotated});
      rest = rest.slice(raw.length);
    } else {
      // Skip the marks of an annotation that was cut, and keep looking after them.
      rest = rest.slice(STRAY_MARK_RE.exec(rest)?.[0].length ?? OPEN.length);
    }
  }
  if (plain) {
    segments.push(stripAnnotations(plain));
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
    const idx = src.search(ANY_MARK_RE);
    return idx === -1 ? undefined : idx;
  },
  tokenizer(src: string): Tokens.Generic | undefined {
    const match = ANNOTATION_RE.exec(src);
    if (match) {
      const [raw, data = '', text = ''] = match;
      return {type: 'annotation', raw, data: decode(data), text};
    }
    // The marks of an annotation that was cut, like by a paragraph break, become
    // empty text, so they don't show up.
    const stray = STRAY_MARK_RE.exec(src);
    return stray ? {type: 'text', raw: stray[0], text: ''} : undefined;
  },
  // Rendering to HTML keeps just the text.
  renderer(token: Tokens.Generic): string {
    return escape(String(token.text));
  },
};
