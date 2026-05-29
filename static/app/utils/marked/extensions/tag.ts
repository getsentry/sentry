import type {TokenizerExtension, Tokens} from 'marked'; // eslint-disable-line no-restricted-imports

export interface TagToken {
  level: 'block' | 'inline';
  name: string;
  raw: string;
  type: 'tag';
  value: Record<string, unknown>;
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

function mergeValue(
  attrs: Record<string, string>,
  body: string
): Record<string, unknown> {
  const value: Record<string, unknown> = {...attrs};
  if (body) {
    try {
      const parsed = JSON.parse(body);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        Object.assign(value, parsed);
      }
    } catch {
      // Body isn't valid JSON — attrs only
    }
  }
  return value;
}

function findTagStart(src: string): number | undefined {
  const idx = src.search(TAG_START_RE);
  if (idx === -1) {
    return undefined;
  }
  const rest = src.slice(idx);
  if (BLOCK_RE.test(rest) || SELF_CLOSING_RE.test(rest)) {
    return idx;
  }
  return undefined;
}

function tokenize(src: string, level: 'block' | 'inline'): Tokens.Generic | undefined {
  let match = BLOCK_RE.exec(src);
  if (match) {
    const [raw, name, attrStr = '', body = ''] = match;
    return {
      type: 'tag',
      raw,
      level,
      name,
      value: mergeValue(parseAttrs(attrStr), body),
    };
  }
  match = SELF_CLOSING_RE.exec(src);
  if (match) {
    const [raw, name, attrStr = ''] = match;
    return {
      type: 'tag',
      raw,
      level,
      name,
      value: parseAttrs(attrStr),
    };
  }
  return undefined;
}
