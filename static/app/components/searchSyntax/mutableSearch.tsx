import {escapeDoubleQuotes} from 'sentry/utils';

import {
  FilterType,
  Token as ParserToken,
  parseSearch,
  TermOperator,
  WildcardOperators,
  type ParseResult,
  type TokenResult,
} from './parser';
import {getKeyName} from './utils';

const EMPTY_OPTION_VALUE = '(empty)';

// Hoisted regular expressions to avoid recompilation in hot paths
const TRIMMABLE_ENDS_RE = /^["(]+|[")]+$/g;
const WILDCARD_ESCAPE_RE = /([*])/g;
const NEEDS_QUOTING_RE = /[\s(),\\"]/;
const VALUE_IS_LIST_RE = /^\[.*\]$/;
const VALUE_IS_QUOTED_RE = /^".*"$/;
const BRACKET_QUOTE_PATTERN_RE = /^(.*), (\[[^\]]+\])"]$/;

const ALLOWED_WILDCARD_FIELDS = new Set<string>([
  'span.description',
  'span.domain',
  'span.status_code',
  'log.body',
  'sentry.normalized_description',
  'transaction',
]);

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
   * A normalized value for lookups. For HAS filters this is the actual field name.
   * For other filters this is the unquoted value string (quotes stripped when applicable),
   * unless the token uses bracket-expression syntax, in which case the brackets are preserved.
   */
  value: string;
  /**
   * When the filter value is a list (e.g. [a,b]) capture the parsed items using the AST.
   * This enables getFilterValues() to return individual values instead of the raw bracket text.
   */
  listValues?: string[];
  /**
   * Wildcard operator for text filters, when applicable.
   */
  wildcard?: WildcardOperators;
}

interface FreeTextToken extends BaseToken {
  type: TokenType.FREE_TEXT;
  value: string;
}

type Token = OperatorToken | FilterToken | FreeTextToken;

function isOp(t: Token): t is OperatorToken {
  return t.type === TokenType.OPERATOR;
}

const BOOLEAN_OPS = ['OR', 'AND'];
function isBooleanOp(token: Token, value: string | undefined) {
  return isOp(token) && value && BOOLEAN_OPS.includes(value);
}

function isParen(token: Token, character: '(' | ')') {
  return isOp(token) && token.value === character;
}

function isSpaceOnly(s: string) {
  return s.trim() === '';
}

function isFilterToken(token: Token): token is FilterToken {
  return token.type === TokenType.FILTER;
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
                | ParserToken.KEY_EXPLICIT_BOOLEAN_TAG
                | ParserToken.KEY_EXPLICIT_NUMBER_TAG
                | ParserToken.KEY_EXPLICIT_STRING_TAG
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

        let wildcard: WildcardOperators | undefined;
        if (t.operator === TermOperator.CONTAINS) {
          wildcard = WildcardOperators.CONTAINS;
        } else if (t.operator === TermOperator.STARTS_WITH) {
          wildcard = WildcardOperators.STARTS_WITH;
        } else if (t.operator === TermOperator.ENDS_WITH) {
          wildcard = WildcardOperators.ENDS_WITH;
        }

        tokens.push({
          type: TokenType.FILTER,
          key: keyName,
          value: lookupValue,
          listValues,
          text,
          wildcard,
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

const KEY_TOKENS = [
  ParserToken.KEY_SIMPLE,
  ParserToken.KEY_EXPLICIT_TAG,
  ParserToken.KEY_AGGREGATE,
  ParserToken.KEY_EXPLICIT_BOOLEAN_TAG,
  ParserToken.KEY_EXPLICIT_NUMBER_TAG,
  ParserToken.KEY_EXPLICIT_STRING_TAG,
  ParserToken.KEY_EXPLICIT_FLAG,
  ParserToken.KEY_EXPLICIT_NUMBER_FLAG,
  ParserToken.KEY_EXPLICIT_STRING_FLAG,
] as const;

function isKeyToken(
  token: TokenResult<ParserToken>
): token is TokenResult<(typeof KEY_TOKENS)[number]> {
  return KEY_TOKENS.includes(token.type as (typeof KEY_TOKENS)[number]);
}

function consolidateUnquotedValues(tokens: Token[]): Token[] {
  const result: Token[] = [];

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i]!;

    if (isFilterToken(token)) {
      const freeTextTokens: FreeTextToken[] = [];
      let j = i + 1;

      // Collect consecutive free text tokens
      while (j < tokens.length && tokens[j]!.type === TokenType.FREE_TEXT) {
        const freeText = tokens[j]! as FreeTextToken;
        if (
          freeText.value !== '(' &&
          freeText.value !== ')' &&
          !BOOLEAN_OPS.includes(freeText.value)
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
            type: token.type,
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
  if (value === '') {
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
 * - removeFilter now works with square bracket lists
 * - getFilterValues now returns an array of values for square bracket lists
 * - getFreeText and setFreeText are now methods instead of getters and setters
 */
export class MutableSearch {
  tokens: Array<Readonly<Token>>;

  /**
   * Creates a `MutableSearch` from a key-value mapping of field:value.
   * This construct doesn't support conditions like `OR` and `AND` or
   * parentheses, so it's only useful for simple queries.
   */
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

  /**
   * Creates a MutableSearch from a string query
   */
  constructor(query: string);
  /**
   * Creates a mutable search query from a list of query parts
   */
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

  /**
   * Adds the filters from a string query to the current MutableSearch query.
   * The string query may consist of multiple key:value pairs separated
   * by spaces.
   */
  addStringMultiFilter(multiFilter: string, shouldEscape = true): void {
    const tmp = new MutableSearch(multiFilter);
    Object.entries(tmp.getFilters()).forEach(([key, values]) => {
      this.addFilterValues(key, values, shouldEscape);
    });
  }

  /**
   * Adds a string filter to the current MutableSearch query. The filter should follow
   * the format key:value or key:\uf00dContains\uf00dvalue or key:\uf00dStartsWith\uf00dvalue or key:\uf00dEndsWith\uf00dvalue.
   */
  addStringFilter(filter: string): this {
    const parsed = parseToFlatTokens(filter).filter(t => isFilterToken(t));
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

  addContainsFilterValues(key: string, values: string[], shouldEscape = true): this {
    for (const value of values) {
      this.addContainsFilterValue(key, value, shouldEscape);
    }
    return this;
  }

  addStartsWithFilterValues(key: string, values: string[], shouldEscape = true): this {
    for (const value of values) {
      this.addStartsWithFilterValue(key, value, shouldEscape);
    }
    return this;
  }

  addEndsWithFilterValues(key: string, values: string[], shouldEscape = true): this {
    for (const value of values) {
      this.addEndsWithFilterValue(key, value, shouldEscape);
    }
    return this;
  }

  private _addDisjunctionFilterValues(
    key: string,
    values: string[],
    shouldEscape = true,
    addFilterValue:
      | 'addFilterValue'
      | 'addContainsFilterValue'
      | 'addStartsWithFilterValue'
      | 'addEndsWithFilterValue'
  ): this {
    if (values.length === 0) {
      return this;
    }
    this.addOp('(');
    for (let i = 0; i < values.length; i++) {
      if (i > 0) {
        this.addOp('OR');
      }
      this[addFilterValue](key, values[i]!, shouldEscape);
    }
    this.addOp(')');
    return this;
  }

  /**
   * Adds the filter values separated by OR operators. This is in contrast to
   * addFilterValues, which implicitly separates each filter value with an AND operator.
   */
  addDisjunctionFilterValues(key: string, values: string[], shouldEscape = true): this {
    return this._addDisjunctionFilterValues(key, values, shouldEscape, 'addFilterValue');
  }

  addDisjunctionContainsFilterValues(
    key: string,
    values: string[],
    shouldEscape = true
  ): this {
    return this._addDisjunctionFilterValues(
      key,
      values,
      shouldEscape,
      'addContainsFilterValue'
    );
  }

  addDisjunctionStartsWithFilterValues(
    key: string,
    values: string[],
    shouldEscape = true
  ): this {
    return this._addDisjunctionFilterValues(
      key,
      values,
      shouldEscape,
      'addStartsWithFilterValue'
    );
  }

  addDisjunctionEndsWithFilterValues(
    key: string,
    values: string[],
    shouldEscape = true
  ): this {
    return this._addDisjunctionFilterValues(
      key,
      values,
      shouldEscape,
      'addEndsWithFilterValue'
    );
  }

  private _addFilterValue(
    key: string,
    value: string,
    shouldEscape = true,
    operator:
      | ''
      | WildcardOperators.CONTAINS
      | WildcardOperators.STARTS_WITH
      | WildcardOperators.ENDS_WITH
  ): this {
    if (key === 'has' || key === '!has') {
      this.tokens.push({type: TokenType.FILTER, key, value, text: `${key}:${value}`});
      return this;
    }

    const escaped = shouldEscape ? escapeFilterValue(value) : value;
    const valueText = quoteIfNeeded(escaped);
    this.tokens.push({
      type: TokenType.FILTER,
      key,
      value: escaped,
      text: `${key}:${operator}${valueText}`,
      wildcard: operator || undefined,
    });

    return this;
  }

  addFilterValue(key: string, value: string, shouldEscape = true): this {
    return this._addFilterValue(key, value, shouldEscape, '');
  }

  addContainsFilterValue(key: string, value: string, shouldEscape = true): this {
    return this._addFilterValue(key, value, shouldEscape, WildcardOperators.CONTAINS);
  }

  addStartsWithFilterValue(key: string, value: string, shouldEscape = true): this {
    return this._addFilterValue(key, value, shouldEscape, WildcardOperators.STARTS_WITH);
  }

  addEndsWithFilterValue(key: string, value: string, shouldEscape = true): this {
    return this._addFilterValue(key, value, shouldEscape, WildcardOperators.ENDS_WITH);
  }

  setFilterValues(key: string, values: string[], shouldEscape = true): this {
    this.removeFilter(key);
    this.addFilterValues(key, values, shouldEscape);
    return this;
  }

  setContainsFilterValues(key: string, values: string[], shouldEscape = true): this {
    this.removeFilter(key);
    this.addContainsFilterValues(key, values, shouldEscape);
    return this;
  }

  setStartsWithFilterValues(key: string, values: string[], shouldEscape = true): this {
    this.removeFilter(key);
    this.addStartsWithFilterValues(key, values, shouldEscape);
    return this;
  }

  setEndsWithFilterValues(key: string, values: string[], shouldEscape = true): this {
    this.removeFilter(key);
    this.addEndsWithFilterValues(key, values, shouldEscape);
    return this;
  }

  private _addFilterValueList(
    key: string,
    values: string[],
    shouldEscape = true,
    operator:
      | ''
      | WildcardOperators.CONTAINS
      | WildcardOperators.STARTS_WITH
      | WildcardOperators.ENDS_WITH
  ): this {
    const escapedValues = values.map(value => {
      const escaped = shouldEscape ? escapeFilterValue(value) : value;
      return quoteIfNeeded(escaped);
    });

    this.tokens.push({
      type: TokenType.FILTER,
      key,
      value: `${operator}[${escapedValues.join(',')}]`,
      listValues: escapedValues,
      text: `${key}:${operator}[${escapedValues.join(',')}]`,
      wildcard: operator || undefined,
    });
    return this;
  }

  addFilterValueList(key: string, values: string[], shouldEscape = true): this {
    return this._addFilterValueList(key, values, shouldEscape, '');
  }

  addContainsFilterValueList(key: string, values: string[], shouldEscape = true): this {
    return this._addFilterValueList(
      key,
      values,
      shouldEscape,
      WildcardOperators.CONTAINS
    );
  }

  addStartsWithFilterValueList(key: string, values: string[], shouldEscape = true): this {
    return this._addFilterValueList(
      key,
      values,
      shouldEscape,
      WildcardOperators.STARTS_WITH
    );
  }

  addEndsWithFilterValueList(key: string, values: string[], shouldEscape = true): this {
    return this._addFilterValueList(
      key,
      values,
      shouldEscape,
      WildcardOperators.ENDS_WITH
    );
  }

  getFilters(): Record<string, string[]> {
    return this.tokens.reduce<Record<string, string[]>>((acc, t) => {
      if (!isFilterToken(t)) {
        return acc;
      }
      const values =
        t.listValues && t.listValues.length > 0 ? t.listValues : [t.value ?? ''];
      (acc[t.key] ??= []).push(...values);
      return acc;
    }, {});
  }

  getFilterValues(key: string): string[] {
    return this.tokens
      .filter((t): t is FilterToken => isFilterToken(t) && t.key === key)
      .flatMap(t =>
        t.listValues && t.listValues.length > 0 ? t.listValues : [t.value ?? '']
      );
  }

  getFilterKeys(): string[] {
    const keys = new Set<string>();
    for (const t of this.tokens) {
      if (isFilterToken(t)) {
        keys.add(t.key);
      }
    }
    return Array.from(keys);
  }

  getTokenKeys(): Array<string | undefined> {
    return this.tokens.map(t => (isFilterToken(t) ? t.key : undefined));
  }

  getFreeText(): string[] {
    return this.tokens.filter(t => t.type === TokenType.FREE_TEXT).map(t => t.value);
  }

  hasFilter(key: string): boolean {
    return this.tokens.some(t => isFilterToken(t) && t.key === key);
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
          if (isBooleanOp(token, token.value)) {
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

    this.tokens = this.tokens.filter(t => !(isFilterToken(t) && t.key === key));

    // Remove any AND/OR operators that have become erroneous due to filtering out tokens
    removeErroneousAndOrOps();

    // Now the really complicated part: removing parens that only have one element in them.
    // Since parens are themselves tokens, this gets tricky. In summary, loop through the
    // tokens until we find the innermost open paren. Then forward search through the rest of the tokens
    // to see if that open paren corresponds to a closed paren with one or fewer items inside.
    // If it does, delete those parens, and loop again until there are no more parens to delete.
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
          // Continue down to the nested parens. We can skip i forward since we know
          // everything between i and j is NOT an open paren.
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

  setFreeText(values: string[]): this {
    this.tokens = this.tokens.filter(t => t.type !== TokenType.FREE_TEXT);
    for (const v of values) {
      this.addFreeText(v);
    }
    return this;
  }

  addOp(value: OperatorToken['value']): this {
    this.tokens.push({type: TokenType.OPERATOR, value, text: value});
    return this;
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
