import {escapeDoubleQuotes} from 'app/utils';

export enum TokenType {
  OP,
  TAG,
  QUERY,
}

export type Token = {
  type: TokenType;
  key?: string;
  value: string;
};

export class QueryResults {
  tagValues: object;
  tokens: Token[];

  constructor(strTokens: string[]) {
    this.tokens = [];
    this.tagValues = {};
    for (let token of strTokens) {
      let tokenState = TokenType.QUERY;

      if (['OR', 'AND'].includes(token.toUpperCase())) {
        this.addOp(token.toUpperCase());
        continue;
      }

      if (token.startsWith('(')) {
        const parenMatch = token.match(/^\(+/g);
        if (parenMatch) {
          this.addOp(parenMatch[0]);
          token = token.replace(/^\(+/g, '');
        }
      }

      // Traverse the token and determine if it is a tag
      // condition or bare words.
      for (let i = 0, len = token.length; i < len; i++) {
        const char = token[i];

        if (i === 0 && (char === '"' || char === ':')) {
          break;
        }

        // We may have entered a tag condition
        if (char === ':') {
          const nextChar = token[i + 1] || '';
          if ([':', ' '].includes(nextChar)) {
            tokenState = TokenType.QUERY;
          } else {
            tokenState = TokenType.TAG;
          }
          break;
        }
      }

      let trailingParen: string = '';
      if (token.endsWith(')')) {
        const parenMatch = token.match(/\)+$/g);
        if (parenMatch) {
          trailingParen = parenMatch[0];
          token = token.replace(/\)+$/g, '');
        }
      }

      if (tokenState === TokenType.QUERY) {
        this.addQuery(token);
      } else if (tokenState === TokenType.TAG) {
        this.addStringTag(token);
      }

      if (trailingParen !== '') {
        this.addOp(trailingParen);
      }
    }
  }

  formatString() {
    const formattedTokens: string[] = [];
    for (const token of this.tokens) {
      switch (token.type) {
        case TokenType.TAG:
          if (token.value === '' || token.value === null) {
            formattedTokens.push(`${token.key}:""`);
          } else if (/[\s\(\)\\"]/g.test(token.value)) {
            formattedTokens.push(`${token.key}:"${escapeDoubleQuotes(token.value)}"`);
          } else {
            formattedTokens.push(`${token.key}:${token.value}`);
          }
          break;
        default:
          formattedTokens.push(token.value);
      }
    }
    return formattedTokens.join(' ').trim();
  }

  addStringTag(value: string) {
    const [key, tag] = formatTag(value);
    this.addTag(key, [tag]);
  }

  addTag(key: string, tags: string[]) {
    for (const t of tags) {
      this.tagValues[key] = Array.isArray(this.tagValues[key])
        ? [...this.tagValues[key], t]
        : [t];
      const token: Token = {type: TokenType.TAG, key, value: t};
      this.tokens.push(token);
    }
  }

  setTag(key: string, tags: string[]) {
    this.removeTag(key);
    this.addTag(key, tags);
  }

  getTags(key: string) {
    return this.tagValues[key];
  }

  removeTag(key: string) {
    this.tokens = this.tokens.filter(token => token.key !== key);
    delete this.tagValues[key];
  }

  addQuery(value: string) {
    const token: Token = {type: TokenType.QUERY, value: formatQuery(value)};
    this.tokens.push(token);
  }

  addOp(value: string) {
    const token: Token = {type: TokenType.OP, value};
    this.tokens.push(token);
  }

  get query(): string[] {
    return this.tokens.filter(t => t.type === TokenType.QUERY).map(t => t.value);
  }

  set query(values: string[]) {
    this.tokens = this.tokens.filter(t => t.type !== TokenType.QUERY);
    for (const v of values) {
      this.addQuery(v);
    }
  }

  copy() {
    const q = new QueryResults([]);
    q.tagValues = {...this.tagValues};
    q.tokens = [...this.tokens];
    return q;
  }
}

/**
 * Tokenize a search into a QueryResult
 *
 *
 * Should stay in sync with src.sentry.search.utils:tokenize_query
 */
export function tokenizeSearch(query: string) {
  const tokens = splitSearchIntoTokens(query);
  return new QueryResults(tokens);
}

/**
 * Convert a QueryResults object back to a query string
 */
export function stringifyQueryObject(results: QueryResults) {
  return results.formatString();
}

/**
 * Splits search strings into tokens for parsing by tokenizeSearch.
 */
function splitSearchIntoTokens(query: string) {
  const queryChars = Array.from(query);
  const tokens: string[] = [];

  let token = '';
  let endOfPrevWord = '';
  let quoteType = '';
  let quoteEnclosed = false;

  queryChars.forEach((char, idx) => {
    const nextChar = queryChars.length - 1 > idx ? queryChars[idx + 1] : null;
    token += char;

    if (nextChar !== null && !isSpace(char) && isSpace(nextChar)) {
      endOfPrevWord = char;
    }

    if (isSpace(char) && !quoteEnclosed && endOfPrevWord !== ':' && !isSpace(token)) {
      tokens.push(token.trim());
      token = '';
    }

    if (["'", '"'].includes(char) && (!quoteEnclosed || quoteType === char)) {
      quoteEnclosed = !quoteEnclosed;
      if (quoteEnclosed) {
        quoteType = char;
      }
    }
  });

  const trimmedToken = token.trim();
  if (trimmedToken !== '') {
    tokens.push(trimmedToken);
  }

  return tokens;
}

/**
 * Checks if the string is only spaces
 */
function isSpace(s: string) {
  return s.trim() === '';
}

/**
 * Splits tags on ':' and removes enclosing quotes if present, and returns both
 * sides of the split as strings.
 */
function formatTag(tag: string) {
  const idx = tag.indexOf(':');
  const key = tag.slice(0, idx).replace(/^"+|"+$/g, '');
  const value = tag.slice(idx + 1).replace(/^"+|"+$/g, '');

  return [key, value];
}

/**
 * Strips enclosing quotes and parens from a query, if present.
 */
function formatQuery(query: string) {
  return query.replace(/^["\(]+|["\)]+$/g, '');
}
