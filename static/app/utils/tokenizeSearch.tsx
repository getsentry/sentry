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

function isBooleanOp(value: string) {
  return ['OR', 'AND'].includes(value.toUpperCase());
}

function isParen(token: Token, character: '(' | ')') {
  return (
    token !== undefined &&
    isOp(token) &&
    ['(', ')'].includes(token.value) &&
    token.value === character
  );
}

// TODO(epurkhiser): This is legacy from before the existence of
// searchSyntax/parser. We should absolutely replace the internals of this API
// with `parseSearch`.

export class QueryResults {
  tagValues: Record<string, string[]>;
  tokens: Token[];

  constructor(strTokens: string[]) {
    this.tokens = [];
    this.tagValues = {};
    for (let token of strTokens) {
      let tokenState = TokenType.QUERY;

      if (isBooleanOp(token)) {
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
      if (token.endsWith(')') && !token.includes('(')) {
        const parenMatch = token.match(/\)+$/g);
        if (parenMatch) {
          trailingParen = parenMatch[0];
          token = token.replace(/\)+$/g, '');
        }
      }

      if (tokenState === TokenType.QUERY && token.length) {
        this.addQuery(token);
      } else if (tokenState === TokenType.TAG) {
        this.addStringTag(token, false);
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
        case TokenType.QUERY:
          if (/[\s\(\)\\"]/g.test(token.value)) {
            formattedTokens.push(`"${escapeDoubleQuotes(token.value)}"`);
          } else {
            formattedTokens.push(token.value);
          }
          break;
        default:
          formattedTokens.push(token.value);
      }
    }
    return formattedTokens.join(' ').trim();
  }

  addStringTag(value: string, shouldEscape = true) {
    const [key, tag] = formatTag(value);
    this.addTagValues(key, [tag], shouldEscape);
    return this;
  }

  addTagValues(tag: string, tagValues: string[], shouldEscape = true) {
    for (const t of tagValues) {
      // Tag values that we insert through the UI can contain special characters
      // that need to escaped. User entered filters should not be escaped.
      const escaped = shouldEscape ? escapeTagValue(t) : t;
      this.tagValues[tag] = Array.isArray(this.tagValues[tag])
        ? [...this.tagValues[tag], escaped]
        : [escaped];
      const token: Token = {type: TokenType.TAG, key: tag, value: escaped};
      this.tokens.push(token);
    }
    return this;
  }

  setTagValues(tag: string, tagValues: string[], shouldEscape = true) {
    this.removeTag(tag);
    this.addTagValues(tag, tagValues, shouldEscape);
    return this;
  }

  getTagValues(tag: string) {
    return this.tagValues[tag] ?? [];
  }

  getTagKeys() {
    return Object.keys(this.tagValues);
  }

  hasTag(tag: string): boolean {
    const tags = this.getTagValues(tag);
    return !!(tags && tags.length);
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
        if (isOp(token) && isBooleanOp(token.value)) {
          if (prev === undefined || isOp(prev) || next === undefined || isOp(next)) {
            // Want to avoid removing `(term) OR (term)`
            if (isParen(prev, ')') && isParen(next, '(')) {
              continue;
            }
            toRemove = i;
            break;
          }
        }
      }
    } while (toRemove >= 0);

    return this;
  }

  removeTagValue(key: string, value: string) {
    const values = this.getTagValues(key);
    if (Array.isArray(values) && values.length) {
      this.setTagValues(
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

  isEmpty() {
    return this.tokens.length === 0;
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
 * Splits search strings into tokens for parsing by tokenizeSearch.
 *
 * Should stay in sync with src.sentry.search.utils:split_query_into_tokens
 */
function splitSearchIntoTokens(query: string) {
  const queryChars = Array.from(query);
  const tokens: string[] = [];

  let token = '';
  let endOfPrevWord = '';
  let quoteType = '';
  let quoteEnclosed = false;

  for (let idx = 0; idx < queryChars.length; idx++) {
    const char = queryChars[idx];
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

    if (quoteEnclosed && char === '\\' && nextChar === quoteType) {
      token += nextChar;
      idx++;
    }
  }

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
  const key = removeSurroundingQuotes(tag.slice(0, idx));
  const value = removeSurroundingQuotes(tag.slice(idx + 1));

  return [key, value];
}

function removeSurroundingQuotes(text: string) {
  const length = text.length;
  if (length <= 1) {
    return text;
  }

  let left = 0;
  for (; left <= length / 2; left++) {
    if (text.charAt(left) !== '"') {
      break;
    }
  }

  let right = length - 1;
  for (; right >= length / 2; right--) {
    if (text.charAt(right) !== '"' || text.charAt(right - 1) === '\\') {
      break;
    }
  }

  return text.slice(left, right + 1);
}

/**
 * Strips enclosing quotes and parens from a query, if present.
 */
function formatQuery(query: string) {
  return query.replace(/^["\(]+|["\)]+$/g, '');
}

/**
 * Some characters have special meaning in a tag value. So when they
 * are directly added as a tag value, we have to escape them to mean
 * the literal.
 */
function escapeTagValue(value: string) {
  // TODO(txiao): The types here are definitely wrong.
  // Need to dig deeper to see where exactly it's wrong.
  //
  // astericks (*) is used for wildcard searches
  return typeof value === 'string' ? value.replace(/([\*])/g, '\\$1') : value;
}
