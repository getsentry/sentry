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
    if (idx === undefined || !isAloneOnItsLine(src, idx)) {
      return undefined;
    }
    return idx;
  },
  tokenizer(src: string): Tokens.Generic | undefined {
    if (!isAloneOnItsLine(src, 0)) {
      return undefined;
    }
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

/**
 * Whether the tag at `idx` is the only thing on its line.
 *
 * A tag alone on its line is a block; a tag sharing a line with prose belongs to that
 * prose. Leading text was always disqualifying -- trailing text has to be too, or a
 * sentence that merely *opens* with a reference ("{% issue %} is the urgent one") has its
 * subject torn out into a full-width card, leaving the rest of the clause stranded
 * underneath.
 *
 * List items are the case that made this matter, and they need no handling of their own:
 * marked strips the `-` or `1.` marker before lexing an item's content, so a bullet that
 * leads with a tag reaches here looking exactly like a paragraph that does, and gets the
 * same answer.
 */
function isAloneOnItsLine(src: string, idx: number): boolean {
  const lineStart = src.lastIndexOf('\n', idx) + 1;
  if (/\S/.test(src.slice(lineStart, idx))) {
    return false;
  }

  const rest = src.slice(idx);
  const raw = (BLOCK_RE.exec(rest) ?? SELF_CLOSING_RE.exec(rest))?.[0];
  if (raw === undefined) {
    return false;
  }

  // A block tag's body may span lines; what matters is the line its closing tag ends on.
  const after = src.slice(idx + raw.length);
  const lineEnd = after.indexOf('\n');
  return !/\S/.test(lineEnd === -1 ? after : after.slice(0, lineEnd));
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
