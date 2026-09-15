import type {TokenizerExtension, Tokens} from 'marked'; // eslint-disable-line no-restricted-imports

export interface TagToken {
  attrs: Record<string, string>;
  data: unknown;
  level: 'block' | 'inline';
  name: string;
  raw: string;
  type: 'tag';
  /**
   * Position of this tag among all tags in the message, in document order.
   *
   * Assigned by `Markdown` after lexing rather than here, because marked defers
   * inline tokenization to a second pass -- so the order tokenizers run in does
   * not match the order tags appear in. Undefined for tokens that were lexed
   * without going through `Markdown`.
   */
  index?: number;
}

const TAG_START_RE = /\{%\s+[\w-]/;
const SELF_CLOSING_RE = /^\{%\s+([\w-]+)((?:\s+[\w-]+="[^"]*")*)\s+\/%\}/;
const BLOCK_RE =
  /^\{%\s+([\w-]+)((?:\s+[\w-]+="[^"]*")*)\s+%\}([\s\S]*?)\{%\s+\/\1\s+%\}/;
const ATTR_RE = /([\w-]+)="([^"]*)"/g;

export const blockTagExtension: TokenizerExtension = {
  name: 'tag',
  level: 'block',
  start(src: string): number | undefined {
    const idx = findTagStart(src);
    if (idx === undefined) {
      return undefined;
    }
    const lineStart = src.lastIndexOf('\n', idx) + 1;
    if (/\S/.test(src.slice(lineStart, idx))) {
      return undefined;
    }
    return idx;
  },
  tokenizer(src: string): Tokens.Generic | undefined {
    return tokenize(src, 'block');
  },
};

export const inlineTagExtension: TokenizerExtension = {
  name: 'tag',
  level: 'inline',
  start(src: string): number | undefined {
    return findTagStart(src);
  },
  tokenizer(src: string): Tokens.Generic | undefined {
    return tokenize(src, 'inline');
  },
};

function parseAttrs(raw: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  for (const [, key, value] of raw.matchAll(ATTR_RE)) {
    if (key !== undefined && value !== undefined) {
      attrs[key] = value;
    }
  }
  return attrs;
}

function parseBody(body: string): unknown {
  if (!body) {
    return undefined;
  }
  try {
    return JSON.parse(body);
  } catch {
    return undefined;
  }
}

function findTagStart(src: string): number | undefined {
  let offset = 0;
  while (offset < src.length) {
    const idx = src.slice(offset).search(TAG_START_RE);
    if (idx === -1) {
      return undefined;
    }
    const absIdx = offset + idx;
    const rest = src.slice(absIdx);
    if (BLOCK_RE.test(rest) || SELF_CLOSING_RE.test(rest)) {
      return absIdx;
    }
    offset = absIdx + 2;
  }
  return undefined;
}

function tokenize(src: string, level: 'block' | 'inline'): TagToken | undefined {
  // The name group is mandatory in both patterns, so these guards never fire at
  // runtime -- they are what lets the return type say `TagToken` rather than a
  // generic token the callers have to assert their way out of.
  const blockMatch = BLOCK_RE.exec(src);
  if (blockMatch) {
    const [raw, name, attrStr = '', body = ''] = blockMatch;
    if (raw !== undefined && name !== undefined) {
      return {
        type: 'tag',
        raw,
        level,
        name,
        attrs: parseAttrs(attrStr),
        data: parseBody(body),
      };
    }
  }

  const selfClosingMatch = SELF_CLOSING_RE.exec(src);
  if (selfClosingMatch) {
    const [raw, name, attrStr = ''] = selfClosingMatch;
    if (raw !== undefined && name !== undefined) {
      return {
        type: 'tag',
        raw,
        level,
        name,
        attrs: parseAttrs(attrStr),
        data: undefined,
      };
    }
  }

  return undefined;
}

/** One piece of a source string: literal text, or a tag with its parsed body. */
export type TagSegment =
  | {type: 'text'; value: string}
  | {attrs: Record<string, string>; data: unknown; name: string; type: 'tag'};

/**
 * Splits a source string into its text and its tags, in document order.
 *
 * The extensions above find tags while marked builds a render tree; this walks
 * the same patterns for callers that want the tags themselves.
 */
export function splitTags(src: string): TagSegment[] {
  const segments: TagSegment[] = [];
  let rest = src;

  while (rest) {
    const start = findTagStart(rest);
    if (start === undefined) {
      break;
    }

    const token = tokenize(rest.slice(start), 'block');
    if (!token) {
      break;
    }

    if (start > 0) {
      segments.push({type: 'text', value: rest.slice(0, start)});
    }
    segments.push({
      type: 'tag',
      name: token.name,
      attrs: token.attrs,
      data: token.data,
    });
    rest = rest.slice(start + token.raw.length);
  }

  if (rest) {
    segments.push({type: 'text', value: rest});
  }

  return segments;
}
