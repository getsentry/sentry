import {escapeDoubleQuotes} from 'sentry/utils';

import {
  FilterType,
  Token as ParserToken,
  parseSearch,
  type ParseResult,
  type TokenResult,
} from './parser';
import {getKeyName} from './utils';

// TODO: Export when being used
const EMPTY_OPTION_VALUE = '(empty)';

// Hoisted regular expressions to avoid recompilation in hot paths
const TRIMMABLE_ENDS_RE = /^["\(]+|["\)]+$/g;
const WILDCARD_ESCAPE_RE = /([\*])/g;
const NEEDS_QUOTING_RE = /[\s\(\)\\"]/;
const VALUE_IS_LIST_RE = /^\[.*\]$/;
const VALUE_IS_QUOTED_RE = /^".*"$/;
const BRACKET_QUOTE_PATTERN_RE = /^(.*), (\[[^\]]+\])\"]$/;

const ALLOWED_WILDCARD_FIELDS = new Set<string>([
  'span.description',
  'span.domain',
  'span.status_code',
  'log.body',
  'sentry.normalized_description',
  'transaction',
]);

// TODO: Export when being used
enum TokenType {
  OPERATOR = 0,
  FILTER = 1,
  FREE_TEXT = 2,
}

interface BaseToken {
  text: string;
  type: TokenType;
}

interface OperatorToken extends BaseToken {
  type: TokenType.OPERATOR;
  value: '(' | ')' | 'AND' | 'OR';
}

interface FilterToken extends BaseToken {
  /**
   * A normalized key used for lookups. For HAS filters this will be 'has' or '!has'.
   * Otherwise it is the concrete key returned by getKeyName().
   */
  key: string;
  type: TokenType.FILTER;
  /**
   * When the filter value is a list (e.g. [a,b]) capture the parsed items using the AST.
   * This enables getFilterValues() to return individual values instead of the raw bracket text.
   */
  listValues?: string[];
  /**
   * A normalized value for lookups. For HAS filters this is the actual field name.
   * For other filters this is the unquoted value string (quotes stripped when applicable),
   * unless the token uses bracket-expression syntax, in which case the brackets are preserved.
   */
  value?: string;
}

interface FreeTextToken extends BaseToken {
  type: TokenType.FREE_TEXT;
  value: string;
}

type Token = OperatorToken | FilterToken | FreeTextToken;

function isOp(t: Token): t is OperatorToken {
  return t.type === TokenType.OPERATOR;
}

function isBooleanOp(value: string) {
  return value === 'OR' || value === 'AND';
}

function isParen(token: Token | undefined, character: '(' | ')') {
  return !!token && isOp(token) && token.value === character;
}

function isSpaceOnly(s: string) {
  return s.trim() === '';
}

function formatQuery(query: string) {
  return query.replace(TRIMMABLE_ENDS_RE, '');
}

function escapeFilterValue(value: string) {
  return typeof value === 'string' ? value.replace(WILDCARD_ESCAPE_RE, '\\$1') : value;
}

function parseToFlatTokens(query: string): Token[] {
  const parsed: ParseResult | null = parseSearch(query, {flattenParenGroups: true});
  const tokens: Token[] = [];

  if (!parsed) {
    const value = query.trim();
    if (!isSpaceOnly(value)) {
      for (const part of value.split(/\s+/)) {
        if (part) {
          tokens.push({type: TokenType.FREE_TEXT, value: part, text: part});
        }
      }
    }
    return tokens;
  }

  for (const t of parsed) {
    switch (t.type) {
      case ParserToken.SPACES:
        // Ignore explicit spaces; formatting will add single spaces
        break;
      case ParserToken.L_PAREN:
        tokens.push({type: TokenType.OPERATOR, value: '(', text: '('});
        break;
      case ParserToken.R_PAREN:
        tokens.push({type: TokenType.OPERATOR, value: ')', text: ')'});
        break;
      case ParserToken.LOGIC_BOOLEAN:
        tokens.push({type: TokenType.OPERATOR, value: t.value, text: t.value});
        break;
      case ParserToken.FREE_TEXT: {
        const v = formatQuery(t.value);
        if (t.quoted) {
          const text = '"' + escapeDoubleQuotes(v) + '"';
          tokens.push({type: TokenType.FREE_TEXT, value: v, text});
        } else {
          for (const part of v.split(/\s+/)) {
            if (part) {
              tokens.push({type: TokenType.FREE_TEXT, value: part, text: part});
            }
          }
        }
        break;
      }
      case ParserToken.FILTER: {
        if (t.filter === FilterType.HAS) {
          const existsKey = t.negated ? '!has' : 'has';
          const valueToken = t.value as
            | TokenResult<
                | ParserToken.VALUE_TEXT
                | ParserToken.KEY_SIMPLE
                | ParserToken.KEY_EXPLICIT_TAG
                | ParserToken.KEY_EXPLICIT_STRING_TAG
                | ParserToken.KEY_EXPLICIT_NUMBER_TAG
                | ParserToken.KEY_EXPLICIT_FLAG
                | ParserToken.KEY_EXPLICIT_STRING_FLAG
                | ParserToken.KEY_EXPLICIT_NUMBER_FLAG
              >
            | null
            | undefined;
          let field = '';
          if (valueToken) {
            if (valueToken.type === ParserToken.VALUE_TEXT) {
              field = valueToken.value;
            } else {
              // valueToken is a key-like token here
              if (isKeyToken(valueToken)) {
                field = getKeyName(valueToken);
              }
            }
          }
          const text = `${existsKey}:${field}`;
          tokens.push({type: TokenType.FILTER, key: existsKey, value: field, text});
          break;
        }

        const keyName = getKeyName(t.key);

        // Prefer unquoted raw value for VALUE_TEXT, otherwise fall back to token text
        let rawVal: string;
        let valueWasQuoted = false;
        let listValues: string[] | undefined;
        if (t.value && t.value.type === ParserToken.VALUE_TEXT) {
          rawVal = t.value.value;
          valueWasQuoted = t.value.quoted;
        } else if (t.value && t.value.type === ParserToken.VALUE_TEXT_LIST) {
          // Extract individual list items from the AST
          listValues = t.value.items
            .map(item => item.value?.value ?? '')
            .filter(v => v.length > 0);
          rawVal = t.value.text;
        } else {
          rawVal = t.value?.text ?? '';
        }
        const lookupValue = rawVal;

        // Apply formatting rules to match legacy behavior
        let text = t.text;
        const isBracketLike = rawVal.startsWith('[') && rawVal.endsWith(']');

        // Special case: remove quotes around colon values (e.g. user:"id:123" -> user:id:123)
        if (
          valueWasQuoted &&
          !isBracketLike &&
          rawVal.includes(':') &&
          !/\s/.test(rawVal)
        ) {
          const op = t.operator ?? '';
          text = `${keyName}:${op}${rawVal}`;
        }

        tokens.push({
          type: TokenType.FILTER,
          key: keyName,
          value: lookupValue,
          listValues,
          text,
        });
        break;
      }
      default:
        break;
    }
  }

  // Post-process to handle cases like "release:4.9.0 build (0.0.01)" -> "release:\"4.9.0 build (0.0.01)\""
  return consolidateUnquotedValues(tokens);
}

function isKeyToken(
  token: TokenResult<ParserToken>
): token is TokenResult<
  | ParserToken.KEY_SIMPLE
  | ParserToken.KEY_EXPLICIT_TAG
  | ParserToken.KEY_AGGREGATE
  | ParserToken.KEY_EXPLICIT_NUMBER_TAG
  | ParserToken.KEY_EXPLICIT_STRING_TAG
  | ParserToken.KEY_EXPLICIT_FLAG
  | ParserToken.KEY_EXPLICIT_NUMBER_FLAG
  | ParserToken.KEY_EXPLICIT_STRING_FLAG
> {
  return (
    token.type === ParserToken.KEY_SIMPLE ||
    token.type === ParserToken.KEY_EXPLICIT_TAG ||
    token.type === ParserToken.KEY_AGGREGATE ||
    token.type === ParserToken.KEY_EXPLICIT_NUMBER_TAG ||
    token.type === ParserToken.KEY_EXPLICIT_STRING_TAG ||
    token.type === ParserToken.KEY_EXPLICIT_FLAG ||
    token.type === ParserToken.KEY_EXPLICIT_NUMBER_FLAG ||
    token.type === ParserToken.KEY_EXPLICIT_STRING_FLAG
  );
}

function consolidateUnquotedValues(tokens: Token[]): Token[] {
  const result: Token[] = [];

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i]!;

    if (token.type === TokenType.FILTER) {
      const freeTextTokens: FreeTextToken[] = [];
      let j = i + 1;

      // Collect consecutive free text tokens
      while (j < tokens.length && tokens[j]!.type === TokenType.FREE_TEXT) {
        const freeText = tokens[j]! as FreeTextToken;
        if (
          !isBooleanOp(freeText.value) &&
          freeText.value !== '(' &&
          freeText.value !== ')'
        ) {
          freeTextTokens.push(freeText);
          j++;
        } else {
          break;
        }
      }

      if (freeTextTokens.length > 0) {
        const nextToken = tokens[j];

        // Case 1: release:X.X.X followed by free text and another filter (release consolidation)
        const isReleaseConsolidation =
          token.key === 'release' && nextToken?.type === TokenType.FILTER;

        // Case 2: Filter with incomplete quoted value (like message:"[test, " followed by [Filtered]"])
        // Detect when a filter looks like it should contain the following free text
        const filterEndsWithQuoteSpace =
          token.text.endsWith('" ') || token.text.endsWith('"');
        const freeTextEndsWithQuoteBracket = freeTextTokens.some(ft =>
          ft.value.endsWith('"]')
        );
        const isIncompleteQuoted =
          filterEndsWithQuoteSpace && freeTextEndsWithQuoteBracket;

        if (isReleaseConsolidation || isIncompleteQuoted) {
          // Reconstruct the filter with the complete value
          let completeValue: string;
          let newText: string;

          if (isIncompleteQuoted) {
            // For incomplete quoted values, merge everything and ensure proper quoting
            completeValue = [token.value, ...freeTextTokens.map(ft => ft.value)].join('');

            // Fix the specific case where parsing breaks nested quotes like:
            // [test, [Filtered]"] should become [test, \"[Filtered]\"]
            let finalValue = completeValue;
            if (BRACKET_QUOTE_PATTERN_RE.test(finalValue)) {
              // Convert pattern PREFIX, [WORD]"] to PREFIX, \"[WORD]\"
              finalValue = finalValue.replace(BRACKET_QUOTE_PATTERN_RE, '$1, \\"$2\\"]');
              newText = `${token.key}:"${finalValue}"`;
            } else {
              // Fallback to general quote escaping
              const escapedValue = completeValue.replace(/"/g, '\\"');
              newText = `${token.key}:"${escapedValue}"`;
            }
          } else {
            // For release consolidation, add quotes around the space-separated value
            completeValue = [token.value, ...freeTextTokens.map(ft => ft.value)].join(
              ' '
            );
            newText = `${token.key}:"${escapeDoubleQuotes(completeValue)}"`;
          }

          result.push({
            type: TokenType.FILTER,
            key: token.key,
            value: completeValue,
            text: newText,
          });
          i = j - 1; // Skip the consumed free text tokens
        } else {
          result.push(token);
        }
      } else {
        result.push(token);
      }
    } else {
      result.push(token);
    }
  }

  return result;
}

function quoteIfNeeded(value: string): string {
  if (value === '' || value === null) {
    return '""';
  }
  if (VALUE_IS_LIST_RE.test(value) || VALUE_IS_QUOTED_RE.test(value)) {
    return value;
  }
  if (NEEDS_QUOTING_RE.test(value)) {
    return '"' + escapeDoubleQuotes(value) + '"';
  }
  return value;
}

/**
 * The MutableSearch class is a wrapper around the query AST that allows
 * for easy modification of the query. It can be used to add and remove
 * filters, operators, and free text.
 *
 * It is different from the old MutableSearch in a few ways:
 * - Using the AST to parse the query string instead of a string tokenizer
 * - getFilterValues now returns an array of values for square bracket lists
 * - removeFilter now works with square bracket lists
 * - getFreeText and setFreeText are now methods instead of getters and setters
 */
export class MutableSearch {
  tokens: Token[];

  static fromQueryObject(
    params: Record<string, string[] | string | number | undefined>
  ): MutableSearch {
    const query = new MutableSearch('');

    for (const [key, value] of Object.entries(params)) {
      if (value === undefined || value === null || value === '') {
        continue;
      }

      if (value === EMPTY_OPTION_VALUE) {
        query.addFilterValue('!has', key);
      } else if (Array.isArray(value)) {
        query.addFilterValues(
          key,
          value.map(v => String(v)),
          !ALLOWED_WILDCARD_FIELDS.has(key)
        );
      } else {
        query.addFilterValue(key, String(value), !ALLOWED_WILDCARD_FIELDS.has(key));
      }
    }

    return query;
  }

  constructor(query: string);
  constructor(queries: string[]);
  constructor(tokensOrQuery: string[] | string) {
    const queryString = Array.isArray(tokensOrQuery)
      ? tokensOrQuery.join(' ')
      : String(tokensOrQuery ?? '');
    this.tokens = parseToFlatTokens(queryString);
  }

  formatString(): string {
    return this.tokens
      .map(t => t.text)
      .join(' ')
      .trim();
  }

  addStringMultiFilter(multiFilter: string, shouldEscape = true): void {
    const tmp = new MutableSearch(multiFilter);
    Object.entries(tmp.getFilters()).forEach(([key, values]) => {
      this.addFilterValues(key, values, shouldEscape);
    });
  }

  addStringFilter(filter: string): this {
    const parsed = parseToFlatTokens(filter).filter(t => t.type === TokenType.FILTER);
    if (parsed.length === 0) {
      return this;
    }
    for (const tok of parsed) {
      this.tokens.push(tok);
    }
    return this;
  }

  addFilterValues(key: string, values: string[], shouldEscape = true): this {
    for (const value of values) {
      this.addFilterValue(key, value, shouldEscape);
    }
    return this;
  }

  addDisjunctionFilterValues(key: string, values: string[], shouldEscape = true): this {
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

  addFilterValue(key: string, value: string, shouldEscape = true): this {
    let text: string;
    if (key === 'has' || key === '!has') {
      const val = String(value);
      text = `${key}:${val}`;
      this.tokens.push({type: TokenType.FILTER, key, value: val, text});
      return this;
    }

    const escaped = shouldEscape ? escapeFilterValue(String(value)) : String(value);
    const valueText = quoteIfNeeded(escaped);
    text = `${key}:${valueText}`;
    this.tokens.push({type: TokenType.FILTER, key, value: escaped, text});
    return this;
  }

  setFilterValues(key: string, values: string[], shouldEscape = true): this {
    this.removeFilter(key);
    this.addFilterValues(key, values, shouldEscape);
    return this;
  }

  getFilters(): Record<string, string[]> {
    const acc: Record<string, string[]> = {};
    for (const t of this.tokens) {
      if (t.type !== TokenType.FILTER) {
        continue;
      }
      const key = t.key;
      const push = (val: string) => {
        if (!acc[key]) {
          acc[key] = [];
        }
        acc[key].push(val);
      };
      if (t.listValues && t.listValues.length > 0) {
        for (const v of t.listValues) {
          push(v);
        }
      } else {
        push(t.value ?? '');
      }
    }
    return acc;
  }

  getFilterValues(key: string): string[] {
    const values: string[] = [];
    for (const t of this.tokens) {
      if (t.type !== TokenType.FILTER) {
        continue;
      }
      if (t.key !== key) {
        continue;
      }
      if (t.listValues && t.listValues.length > 0) {
        for (const v of t.listValues) {
          values.push(v);
        }
      } else {
        values.push(t.value ?? '');
      }
    }
    return values;
  }

  getFilterKeys(): string[] {
    const keys = new Set<string>();
    for (const t of this.tokens) {
      if (t.type === TokenType.FILTER) {
        keys.add(t.key);
      }
    }
    return Array.from(keys);
  }

  getTokenKeys(): Array<string | undefined> {
    return this.tokens.map(t => (t.type === TokenType.FILTER ? t.key : undefined));
  }

  hasFilter(key: string): boolean {
    for (const t of this.tokens) {
      if (t.type === TokenType.FILTER && t.key === key) {
        return true;
      }
    }
    return false;
  }

  removeFilter(key: string): this {
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

    this.tokens = this.tokens.filter(
      t => !(t.type === TokenType.FILTER && t.key === key)
    );

    removeErroneousAndOrOps();

    let parensToDelete: number[] = [];
    const cleanParens = (_: unknown, idx: number) => !parensToDelete.includes(idx);
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
            i = j - 1;
            break;
          } else if (!isOp(nextToken)) {
            if (alreadySeen) {
              break;
            }
            alreadySeen = true;
          } else if (isOp(nextToken) && nextToken.value === ')') {
            parensToDelete = [i, j];
            break;
          }
        }

        if (parensToDelete.length > 0) {
          break;
        }
      }
    } while (parensToDelete.length > 0);

    removeErroneousAndOrOps();

    return this;
  }

  removeFilterValue(key: string, value: string): this {
    const values = this.getFilterValues(key);
    if (Array.isArray(values) && values.length) {
      this.setFilterValues(
        key,
        values.filter(item => item !== value)
      );
    }
    return this;
  }

  addFreeText(value: string): this {
    const v = formatQuery(value);
    const text = NEEDS_QUOTING_RE.test(v) ? '"' + escapeDoubleQuotes(v) + '"' : v;
    this.tokens.push({type: TokenType.FREE_TEXT, value: v, text});
    return this;
  }

  addOp(value: OperatorToken['value']): this {
    this.tokens.push({type: TokenType.OPERATOR, value, text: value});
    return this;
  }

  getFreeText(): string[] {
    return this.tokens.filter(t => t.type === TokenType.FREE_TEXT).map(t => t.value);
  }

  setFreeText(values: string[]): void {
    this.tokens = this.tokens.filter(t => t.type !== TokenType.FREE_TEXT);
    for (const v of values) {
      this.addFreeText(v);
    }
  }

  copy(): MutableSearch {
    const q = new MutableSearch('');
    q.tokens = [...this.tokens];
    return q;
  }

  isEmpty(): boolean {
    return this.tokens.length === 0;
  }

  toString(): string {
    return this.formatString();
  }
}
