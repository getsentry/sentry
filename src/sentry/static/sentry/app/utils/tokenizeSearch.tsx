import {escapeDoubleQuotes} from 'app/utils';

export enum TokenType {
  OP,
  TAG,
  QUERY,
}

export type Token = {
  type: TokenType;
  value: string;
  key?: string;
};

function isOp(t: Token) {
  return t.type === TokenType.OP;
}

export class QueryResults {
  tagValues: Record<string, string[]>;
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
          parenMatch[0].split('').map(paren => this.addOp(paren));
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

      let trailingParen = '';
      if (token.endsWith(')')) {
        const parenMatch = token.match(/\)+$/g);
        if (parenMatch) {
          trailingParen = parenMatch[0];
          token = token.replace(/\)+$/g, '');
        }
      }

      if (tokenState === TokenType.QUERY && token.length) {
        this.addQuery(token);
      } else if (tokenState === TokenType.TAG) {
        this.addStringTag(token);
      }

      if (trailingParen !== '') {
        trailingParen.split('').map(paren => this.addOp(paren));
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
    return this;
  }

  addTag(key: string, tags: string[]) {
    for (const t of tags) {
      this.tagValues[key] = Array.isArray(this.tagValues[key])
        ? [...this.tagValues[key], t]
        : [t];
      const token: Token = {type: TokenType.TAG, key, value: t};
      this.tokens.push(token);
    }
    return this;
  }

  setTag(key: string, tags: string[]) {
    this.removeTag(key);
    this.addTag(key, tags);
    return this;
  }

  getTags(key: string) {
    return this.tagValues[key];
  }

  hasTags(key: string) {
    const tags = this.getTags(key);
    return tags && tags.length;
  }

  removeTag(key: string) {
    this.tokens = this.tokens.filter(token => token.key !== key);
    delete this.tagValues[key];

    // Now the really complicated part: removing parens that only have one element in them.
    // Since parens are themselves tokens, this gets tricky. In summary, loop through the
    // tokens until we find the innermost open paren. Then forward search through the rest of the tokens
    // to see if that open paren corresponds to a closed paren with one or fewer items inside.
    // If it does, delete those parens, and loop again until there are no more parens to delete.
    let parensToDelete: number[] = [];
    const cleanParens = (_, idx: number) => !parensToDelete.includes(idx);
    do {
      if (parensToDelete.length) {
        this.tokens = this.tokens.filter(cleanParens);
      }
      parensToDelete = [];

      for (let i = 0; i < this.tokens.length; i++) {
        const token = this.tokens[i];
        if (!isOp(token) || token.value !== '(') {
          continue;
        }

        let alreadySeen = false;
        for (let j = i + 1; j < this.tokens.length; j++) {
          const nextToken = this.tokens[j];
          if (isOp(nextToken) && nextToken.value === '(') {
            // Continue down to the nested parens. We can skip i forward since we know
            // everything between i and j is NOT an open paren.
            i = j - 1;
            break;
          } else if (!isOp(nextToken)) {
            if (alreadySeen) {
              // This has more than one term, no need to delete
              break;
            }
            alreadySeen = true;
          } else if (isOp(nextToken) && nextToken.value === ')') {
            // We found another paren with zero or one terms inside. Delete the pair.
            parensToDelete = [i, j];
            break;
          }
        }

        if (parensToDelete.length > 0) {
          break;
        }
      }
    } while (parensToDelete.length > 0);

    // Now that all erroneous parens are removed we need to remove dangling OR/AND operators.
    // I originally removed all the dangling properties in a single loop, but that meant that
    // cases like `a OR OR b` would remove both operators, when only one should be removed. So
    // instead, we loop until we find an operator to remove, then go back to the start and loop
    // again.
    let toRemove = -1;
    do {
      if (toRemove >= 0) {
        this.tokens.splice(toRemove, 1);
        toRemove = -1;
      }

      for (let i = 0; i < this.tokens.length; i++) {
        const token = this.tokens[i];
        const prev = this.tokens[i - 1];
        const next = this.tokens[i + 1];
        if (isOp(token) && ['OR', 'AND'].includes(token.value)) {
          if (prev === undefined || isOp(prev) || next === undefined || isOp(next)) {
            toRemove = i;
            break;
          }
        }
      }
    } while (toRemove >= 0);

    return this;
  }

  removeTagValue(key: string, value: string) {
    const values = this.getTags(key);
    if (Array.isArray(values) && values.length) {
      this.setTag(
        key,
        values.filter(item => item !== value)
      );
    }
  }

  addQuery(value: string) {
    const token: Token = {type: TokenType.QUERY, value: formatQuery(value)};
    this.tokens.push(token);
    return this;
  }

  addOp(value: string) {
    const token: Token = {type: TokenType.OP, value};
    this.tokens.push(token);
    return this;
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
