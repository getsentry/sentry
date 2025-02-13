import {escapeDoubleQuotes} from 'sentry/utils';

export const ALLOWED_WILDCARD_FIELDS = [
  'span.description',
  'span.domain',
  'span.status_code',
  'log.body',
];
export const EMPTY_OPTION_VALUE = '(empty)';

export enum TokenType {
  OPERATOR = 0,
  FILTER = 1,
  FREE_TEXT = 2,
}

export type Token = {
  type: TokenType;
  value: string;
  key?: string;
};

function isOp(t: Token) {
  return t.type === TokenType.OPERATOR;
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

export class MutableSearch {
  tokens: Token[];

  /**
   * Creates a `MutableSearch` from a key-value mapping of field:value.
   * This construct doesn't support conditions like `OR` and `AND` or
   * parentheses, so it's only useful for simple queries.
   * @param params
   * @returns {MutableSearch}
   */
  static fromQueryObject(params: {
    [key: string]: string[] | string | number | undefined;
  }): MutableSearch {
    const query = new MutableSearch('');

    Object.entries(params).forEach(([key, value]) => {
      if (!value) {
        return;
      }

      if (value === EMPTY_OPTION_VALUE) {
        query.addFilterValue('!has', key);
      } else if (Array.isArray(value)) {
        query.addFilterValues(key, value, !ALLOWED_WILDCARD_FIELDS.includes(key));
      } else {
        query.addFilterValue(
          key,
          value.toString(),
          !ALLOWED_WILDCARD_FIELDS.includes(key)
        );
      }
    });

    return query;
  }

  /**
   * Creates a MutableSearch from a string query
   */
  constructor(query: string);
  /**
   * Creates a mutable search query from a list of query parts
   */
  constructor(queries: string[]);
  constructor(tokensOrQuery: string[] | string) {
    const strTokens = Array.isArray(tokensOrQuery)
      ? tokensOrQuery
      : splitSearchIntoTokens(tokensOrQuery);

    this.tokens = [];

    for (let token of strTokens) {
      let tokenState = TokenType.FREE_TEXT;

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

      // Traverse the token and check if it's a filter condition or free text
      for (let i = 0, len = token.length; i < len; i++) {
        const char = token[i];

        if (i === 0 && (char === '"' || char === ':')) {
          break;
        }

        // We may have entered a filter condition
        if (char === ':') {
          const nextChar = token[i + 1] || '';
          if ([':', ' '].includes(nextChar)) {
            tokenState = TokenType.FREE_TEXT;
          } else {
            tokenState = TokenType.FILTER;
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

      if (tokenState === TokenType.FREE_TEXT && token.length) {
        this.addFreeText(token);
      } else if (tokenState === TokenType.FILTER) {
        this.addStringFilter(token, false);
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
        case TokenType.FILTER:
          if (token.value === '' || token.value === null) {
            formattedTokens.push(`${token.key}:""`);
          } else if (/[\s\(\)\\"]/g.test(token.value)) {
            formattedTokens.push(`${token.key}:"${escapeDoubleQuotes(token.value)}"`);
          } else {
            formattedTokens.push(`${token.key}:${token.value}`);
          }
          break;
        case TokenType.FREE_TEXT:
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

  /**
   * Adds the filters from a string query to the current MutableSearch query.
   * The string query may consist of multiple key:value pairs separated
   * by spaces.
   */
  addStringMultiFilter(multiFilter: string, shouldEscape = true) {
    Object.entries(new MutableSearch(multiFilter).filters).forEach(([key, values]) => {
      this.addFilterValues(key, values, shouldEscape);
    });
  }

  /**
   * Adds a string filter to the current MutableSearch query. The filter should follow
   * the format key:value.
   */
  addStringFilter(filter: string, shouldEscape = true) {
    const [key, value] = parseFilter(filter);
    this.addFilterValues(key!, [value!], shouldEscape);
    return this;
  }

  addFilterValues(key: string, values: string[], shouldEscape = true) {
    for (const value of values) {
      this.addFilterValue(key, value, shouldEscape);
    }
    return this;
  }

  /**
   * Adds the filter values separated by OR operators. This is in contrast to
   * addFilterValues, which implicitly separates each filter value with an AND operator.
   */
  addDisjunctionFilterValues(key: string, values: string[], shouldEscape = true) {
    if (values.length === 0) {
      return this;
    }

    this.addOp('(');
    for (let i = 0; i < values.length; i++) {
      if (i > 0) {
        this.addOp('OR');
      }
      this.addFilterValue(key, values[i]!, shouldEscape);
    }
    this.addOp(')');
    return this;
  }

  addFilterValue(key: string, value: string, shouldEscape = true) {
    // Filter values that we insert through the UI can contain special characters
    // that need to escaped. User entered filters should not be escaped.
    const escaped = shouldEscape ? escapeFilterValue(value) : value;
    const token: Token = {type: TokenType.FILTER, key, value: escaped};
    this.tokens.push(token);
  }

  setFilterValues(key: string, values: string[], shouldEscape = true) {
    this.removeFilter(key);
    this.addFilterValues(key, values, shouldEscape);
    return this;
  }

  get filters() {
    type Filters = Record<string, string[]>;

    const reducer = (acc: Filters, token: Token) => ({
      ...acc,
      [token.key!]: [...(acc[token.key!] ?? []), token.value],
    });

    return this.tokens
      .filter(t => t.type === TokenType.FILTER)
      .reduce<Filters>(reducer, {});
  }

  getFilterValues(key: string) {
    return this.filters[key] ?? [];
  }

  getFilterKeys() {
    return Object.keys(this.filters);
  }

  hasFilter(key: string): boolean {
    return this.getFilterValues(key).length > 0;
  }

  removeFilter(key: string) {
    const removeErroneousAndOrOps = () => {
      let toRemove = -1;
      do {
        if (toRemove >= 0) {
          this.tokens.splice(toRemove, 1);
          toRemove = -1;
        }

        for (let i = 0; i < this.tokens.length; i++) {
          const token = this.tokens[i]!;
          const prev = this.tokens[i - 1];
          const next = this.tokens[i + 1];
          if (isOp(token) && isBooleanOp(token.value)) {
            if (prev === undefined || isOp(prev) || next === undefined || isOp(next)) {
              // Want to avoid removing `(term) OR (term)` and `term OR (term)`
              if (
                prev &&
                next &&
                (isParen(prev, ')') || !isOp(prev)) &&
                (isParen(next, '(') || !isOp(next))
              ) {
                continue;
              }
              toRemove = i;
              break;
            }
          }
        }
      } while (toRemove >= 0);
    };

    this.tokens = this.tokens.filter(token => token.key !== key);

    // Remove any AND/OR operators that have become erroneous due to filtering out tokens
    removeErroneousAndOrOps();

    // Now the really complicated part: removing parens that only have one element in them.
    // Since parens are themselves tokens, this gets tricky. In summary, loop through the
    // tokens until we find the innermost open paren. Then forward search through the rest of the tokens
    // to see if that open paren corresponds to a closed paren with one or fewer items inside.
    // If it does, delete those parens, and loop again until there are no more parens to delete.
    let parensToDelete: number[] = [];
    const cleanParens = (_: any, idx: number) => !parensToDelete.includes(idx);
    do {
      if (parensToDelete.length) {
        this.tokens = this.tokens.filter(cleanParens);
      }
      parensToDelete = [];

      for (let i = 0; i < this.tokens.length; i++) {
        const token = this.tokens[i]!;
        if (!isOp(token) || token.value !== '(') {
          continue;
        }

        let alreadySeen = false;
        for (let j = i + 1; j < this.tokens.length; j++) {
          const nextToken = this.tokens[j]!;
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
    removeErroneousAndOrOps();

    return this;
  }

  removeFilterValue(key: string, value: string) {
    const values = this.getFilterValues(key);
    if (Array.isArray(values) && values.length) {
      this.setFilterValues(
        key,
        values.filter(item => item !== value)
      );
    }
    return this;
  }

  addFreeText(value: string) {
    const token: Token = {type: TokenType.FREE_TEXT, value: formatQuery(value)};
    this.tokens.push(token);
    return this;
  }

  addOp(value: string) {
    const token: Token = {type: TokenType.OPERATOR, value};
    this.tokens.push(token);
    return this;
  }

  get freeText(): string[] {
    return this.tokens.filter(t => t.type === TokenType.FREE_TEXT).map(t => t.value);
  }

  set freeText(values: string[]) {
    this.tokens = this.tokens.filter(t => t.type !== TokenType.FREE_TEXT);
    for (const v of values) {
      this.addFreeText(v);
    }
  }

  copy() {
    const q = new MutableSearch([]);
    q.tokens = [...this.tokens];
    return q;
  }

  isEmpty() {
    return this.tokens.length === 0;
  }
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
    const char = queryChars[idx]!;
    const nextChar = queryChars.length - 1 > idx ? queryChars[idx + 1]! : null;
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
 * Splits a filter on ':' and removes enclosing quotes if present, and returns
 * both sides of the split as strings.
 */
function parseFilter(filter: string) {
  const idx = filter.indexOf(':');
  const key = removeSurroundingQuotes(filter.slice(0, idx));
  const value = removeSurroundingQuotes(filter.slice(idx + 1));

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
 * Some characters have special meaning in a filter value. So when they are
 * directly added as a value, we have to escape them to mean the literal.
 */
export function escapeFilterValue(value: string) {
  // TODO(txiao): The types here are definitely wrong.
  // Need to dig deeper to see where exactly it's wrong.
  //
  // astericks (*) is used for wildcard searches
  return typeof value === 'string' ? value.replace(/([\*])/g, '\\$1') : value;
}
