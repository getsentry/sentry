/**
 * Structural parser for Sentry's search syntax.
 *
 * This file is written by hand. Peggy only generates code from
 * `grammar.pegjs`, at build time; that output is not checked in.
 *
 * Runs `grammar.pegjs` and builds the same token tree as the Sentry
 * frontend's `parseSearch` (static/app/components/searchSyntax/parser.tsx):
 * the same token types, text, locations and filter classification. The shared
 * fixtures in `fixtures/search-syntax`, which the frontend parser and the
 * backend `event_search.py` grammar also test against, check that.
 *
 * {@link TokenConverter} only does structural work. It never marks a token
 * invalid, attaches warnings, or fills `parsed` values. Products that need
 * that subclass it and override the `checkInvalid*` hooks, the key-type
 * predicates or the token builders.
 */

import {parse as parseGrammar} from './grammar.pegjs';
import {BooleanOperator, FilterType, TermOperator, Token} from './tokens';

export type SourcePosition = {
  column: number;
  line: number;
  offset: number;
};

export type SourceLocation = {
  end: SourcePosition;
  /**
   * Peggy's `grammarSource` option. The grammar options don't take one, so
   * this is always `undefined`.
   */
  source: undefined;
  start: SourcePosition;
};

type BaseToken<T extends Token> = {
  location: SourceLocation;
  /** The exact input text this token covers. */
  text: string;
  type: T;
};

/**
 * Why a token is invalid. The structural converter never sets one; a
 * subclass with product-specific validation can.
 */
export type InvalidToken = {
  reason: string;
  type: string;
  expectedType?: FilterType[];
} | null;

export type SpacesToken = BaseToken<Token.SPACES> & {value: string};

export type KeySimpleToken = BaseToken<Token.KEY_SIMPLE> & {
  quoted: boolean;
  value: string;
};

type PrefixedKeyToken<T extends Token> = BaseToken<T> & {
  key: KeySimpleToken;
  prefix: string;
};

export type KeyExplicitFlagToken = PrefixedKeyToken<Token.KEY_EXPLICIT_FLAG>;
export type KeyExplicitStringFlagToken = PrefixedKeyToken<Token.KEY_EXPLICIT_STRING_FLAG>;
export type KeyExplicitNumberFlagToken = PrefixedKeyToken<Token.KEY_EXPLICIT_NUMBER_FLAG>;
export type KeyExplicitTagToken = PrefixedKeyToken<Token.KEY_EXPLICIT_TAG>;
export type KeyExplicitStringTagToken = PrefixedKeyToken<Token.KEY_EXPLICIT_STRING_TAG>;
export type KeyExplicitNumberTagToken = PrefixedKeyToken<Token.KEY_EXPLICIT_NUMBER_TAG>;
export type KeyExplicitBooleanTagToken = PrefixedKeyToken<Token.KEY_EXPLICIT_BOOLEAN_TAG>;
export type KeyExplicitArrayTagToken = PrefixedKeyToken<Token.KEY_EXPLICIT_ARRAY_TAG>;

/** An array element key such as `foo[*]`. */
export type KeyArrayIncludesToken = BaseToken<Token.KEY_ARRAY_INCLUDES> & {
  index: string;
  key: KeySimpleToken | KeyExplicitArrayTagToken;
};

export type KeyAggregateParamToken = BaseToken<Token.KEY_AGGREGATE_PARAMS> & {
  quoted: boolean;
  value: string;
};

export type ListItem<V> = {separator: string; value: V | null};

export type KeyAggregateArgsToken = BaseToken<Token.KEY_AGGREGATE_ARGS> & {
  args: Array<ListItem<KeyAggregateParamToken>>;
};

export type KeyAggregateToken = BaseToken<Token.KEY_AGGREGATE> & {
  args: KeyAggregateArgsToken | null;
  argsSpaceAfter: SpacesToken;
  argsSpaceBefore: SpacesToken;
  name: KeySimpleToken;
};

export type KeyToken =
  | KeySimpleToken
  | KeyExplicitFlagToken
  | KeyExplicitStringFlagToken
  | KeyExplicitNumberFlagToken
  | KeyExplicitTagToken
  | KeyExplicitStringTagToken
  | KeyExplicitNumberTagToken
  | KeyExplicitBooleanTagToken
  | KeyExplicitArrayTagToken
  | KeyArrayIncludesToken
  | KeyAggregateToken;

export type ValueIso8601DateToken = BaseToken<Token.VALUE_ISO_8601_DATE> & {
  date: string;
  time: string | undefined | null;
  tz: string | undefined | null;
  value: string;
};

export type ValueRelativeDateToken = BaseToken<Token.VALUE_RELATIVE_DATE> & {
  sign: '-' | '+';
  unit: 'w' | 'd' | 'h' | 'm';
  value: string;
};

export type ValueDurationToken = BaseToken<Token.VALUE_DURATION> & {
  unit: string;
  value: string;
};

export type ValueSizeToken = BaseToken<Token.VALUE_SIZE> & {
  unit: string;
  value: string;
};

export type ValuePercentageToken = BaseToken<Token.VALUE_PERCENTAGE> & {
  value: string;
};

export type ValueBooleanToken = BaseToken<Token.VALUE_BOOLEAN> & {
  value: string;
};

export type ValueNumberToken = BaseToken<Token.VALUE_NUMBER> & {
  unit: string | null;
  value: string;
};

export type ValueTextToken = BaseToken<Token.VALUE_TEXT> & {
  quoted: boolean;
  value: string;
};

export type ValueNumberListToken = BaseToken<Token.VALUE_NUMBER_LIST> & {
  items: Array<ListItem<ValueNumberToken>>;
};

export type ValueTextListToken = BaseToken<Token.VALUE_TEXT_LIST> & {
  items: Array<ListItem<ValueTextToken>>;
};

export type ValueToken =
  | ValueIso8601DateToken
  | ValueRelativeDateToken
  | ValueDurationToken
  | ValueSizeToken
  | ValuePercentageToken
  | ValueBooleanToken
  | ValueNumberToken
  | ValueTextToken
  | ValueNumberListToken
  | ValueTextListToken;

export type FilterToken = BaseToken<Token.FILTER> & {
  filter: FilterType;
  invalid: InvalidToken;
  key: KeyToken;
  negated: boolean;
  operator: TermOperator;
  /** `has:` filters may hold a key token as their value. */
  value: ValueToken | KeyToken;
};

export type FreeTextToken = BaseToken<Token.FREE_TEXT> & {
  invalid: InvalidToken;
  quoted: boolean;
  value: string;
};

export type LogicBooleanToken = BaseToken<Token.LOGIC_BOOLEAN> & {
  invalid: InvalidToken;
  value: BooleanOperator;
};

export type LParenToken = BaseToken<Token.L_PAREN> & {
  invalid: InvalidToken;
  value: '(';
};

export type RParenToken = BaseToken<Token.R_PAREN> & {
  invalid: InvalidToken;
  value: ')';
};

export type LogicGroupToken = BaseToken<Token.LOGIC_GROUP> & {
  inner: ParseResultToken[];
};

/** A top-level token, or one directly inside a {@link LogicGroupToken}. */
export type ParseResultToken =
  | SpacesToken
  | FilterToken
  | FreeTextToken
  | LogicBooleanToken
  | LogicGroupToken
  | LParenToken
  | RParenToken;

export type ParseResult = ParseResultToken[];

/** The structural part of the frontend's `SearchConfig`. */
export type SearchConfig = {
  /** Parse `key://pattern//` as a regex filter rather than literal text. */
  allowRegex: boolean;
  booleanKeys: Set<string>;
  dateKeys: Set<string>;
  durationKeys: Set<string>;
  numericKeys: Set<string>;
  /** Aggregates whose filters take percentage values. */
  percentageKeys: Set<string>;
  sizeKeys: Set<string>;
  /** Text filter keys that may carry a comparison operator. */
  textOperatorKeys: Set<string>;
  /** Return paren tokens instead of {@link LogicGroupToken}s. */
  flattenParenGroups?: boolean;
};

/** The default key sets, matching the frontend's `defaultConfig`. */
export const defaultConfig: SearchConfig = {
  textOperatorKeys: new Set([
    'release.version',
    'release.build',
    'release.package',
    'release.stage',
  ]),
  durationKeys: new Set(['transaction.duration']),
  percentageKeys: new Set(['percentage']),
  numericKeys: new Set([
    'project_id',
    'project.id',
    'issue.id',
    'stack.colno',
    'stack.lineno',
    'stack.stack_level',
    'transaction.duration',
  ]),
  dateKeys: new Set([
    'start',
    'end',
    'firstSeen',
    'lastSeen',
    'last_seen()',
    'time',
    'event.timestamp',
    'timestamp',
    'timestamp.to_hour',
    'timestamp.to_day',
  ]),
  booleanKeys: new Set([
    'error.handled',
    'error.unhandled',
    'stack.in_app',
    'team_key_transaction',
    'symbolicated_in_app',
  ]),
  sizeKeys: new Set(),
  allowRegex: false,
};

const MEASUREMENT_PATTERN = /^measurements\.[\w.-]+$/;
const SPAN_OP_BREAKDOWN_PREFIX = 'spans.';

/**
 * Web and mobile vitals whose value type is a duration, from the frontend's
 * `MEASUREMENT_FIELDS`. Other measurements are plain numbers.
 */
const DURATION_MEASUREMENTS = new Set([
  'measurements.fp',
  'measurements.fcp',
  'measurements.lcp',
  'measurements.fid',
  'measurements.ttfb',
  'measurements.ttfb.requesttime',
  'measurements.inp',
  'measurements.app_start_cold',
  'measurements.app_start_warm',
  'measurements.stall_total_time',
  'measurements.stall_longest_time',
  'measurements.time_to_full_display',
  'measurements.time_to_initial_display',
]);

type GetKeyNameOptions = {
  /** Include the arguments of aggregate keys, e.g. `p95(span.duration)`. */
  aggregateWithArgs?: boolean;
};

/** The key name the API expects for a filter key. Matches the frontend. */
export function getKeyName(key: KeyToken, options: GetKeyNameOptions = {}): string {
  switch (key.type) {
    case Token.KEY_SIMPLE:
      return key.value;
    case Token.KEY_EXPLICIT_TAG:
      return key.key.value;
    case Token.KEY_AGGREGATE:
      return options.aggregateWithArgs
        ? `${key.name.value}(${key.args ? key.args.text : ''})`
        : key.name.value;
    case Token.KEY_ARRAY_INCLUDES:
      return getKeyName(key.key);
    default:
      return key.text;
  }
}

type RawListItem<V> = [
  space1: SpacesToken,
  comma: string,
  space2: SpacesToken,
  value?: [notComma: undefined, value: V | null] | null,
];

function joinListItem<V>([space1, comma, space2, value]: RawListItem<V>): ListItem<V> {
  return {
    separator: [space1.value, comma, space2.value].join(''),
    value: value ? value[1] : null,
  };
}

/** What the grammar passes to the converter's constructor. */
export type ConverterOptions<C extends SearchConfig> = {
  config: C;
  location: () => SourceLocation;
  text: () => string;
};

/**
 * Builds tokens for the grammar. The grammar calls these methods directly,
 * so their names and argument order follow the grammar actions.
 */
export class TokenConverter<C extends SearchConfig = SearchConfig> {
  protected readonly text: () => string;
  protected readonly location: () => SourceLocation;
  protected readonly config: C;

  constructor({text, location, config}: ConverterOptions<C>) {
    this.text = text;
    this.location = location;
    this.config = config;
  }

  protected get defaultTokenFields(): {
    location: SourceLocation;
    text: string;
  } {
    return {text: this.text(), location: this.location()};
  }

  // -- Key type predicates ------------------------------------------------

  isNumericKey(key: string): boolean {
    return (
      this.config.numericKeys.has(key) ||
      MEASUREMENT_PATTERN.test(key) ||
      key.startsWith(SPAN_OP_BREAKDOWN_PREFIX) ||
      this.isDurationKey(key) ||
      this.isSizeKey(key)
    );
  }

  isBooleanKey(key: string): boolean {
    return this.config.booleanKeys.has(key);
  }

  isPercentageKey(key: string): boolean {
    return this.config.percentageKeys.has(key);
  }

  isDateKey(key: string): boolean {
    return this.config.dateKeys.has(key);
  }

  isDurationKey(key: string): boolean {
    return (
      this.config.durationKeys.has(key) ||
      key.startsWith(SPAN_OP_BREAKDOWN_PREFIX) ||
      DURATION_MEASUREMENTS.has(key)
    );
  }

  isSizeKey(key: string): boolean {
    return this.config.sizeKeys.has(key);
  }

  // -- Validation hooks (structural parsing never marks tokens invalid) ---

  checkInvalidFilter(
    _filter: FilterType,
    _key: KeyToken,
    _value: FilterToken['value'],
    _negated: boolean,
    _operator: TermOperator
  ): InvalidToken {
    return null;
  }

  checkInvalidFreeText(_value: string): InvalidToken {
    return null;
  }

  checkInvalidLogicalBoolean(_value: BooleanOperator): InvalidToken {
    return null;
  }

  checkInvalidParen(): InvalidToken {
    return null;
  }

  // -- Tokens -------------------------------------------------------------

  tokenSpaces(value: string): SpacesToken {
    return {...this.defaultTokenFields, type: Token.SPACES, value};
  }

  tokenFilter(
    filter: FilterType,
    key: KeyToken,
    value: FilterToken['value'],
    operator: TermOperator | undefined | null,
    negated: boolean,
    wildcard?: TermOperator
  ): FilterToken {
    let operatorToUse = operator ?? TermOperator.DEFAULT;
    if (wildcard && (filter === FilterType.TEXT || filter === FilterType.TEXT_IN)) {
      operatorToUse = wildcard;
    }
    return {
      ...this.defaultTokenFields,
      type: Token.FILTER,
      filter,
      key,
      value,
      negated,
      operator: operatorToUse,
      invalid: this.checkInvalidFilter(filter, key, value, negated, operatorToUse),
    };
  }

  tokenRegexFilter(
    key: KeyToken,
    literal: ValueTextToken,
    pattern: ValueTextToken,
    negated: boolean
  ): FilterToken {
    const filter =
      key.type === Token.KEY_ARRAY_INCLUDES ? FilterType.ARRAY_INCLUDES : FilterType.TEXT;
    if (!this.config.allowRegex) {
      return this.tokenFilter(filter, key, literal, TermOperator.DEFAULT, negated);
    }
    return this.tokenFilter(filter, key, pattern, TermOperator.MATCHES, negated);
  }

  tokenLParen(value: '('): LParenToken {
    return {
      ...this.defaultTokenFields,
      type: Token.L_PAREN,
      value,
      invalid: this.checkInvalidParen(),
    };
  }

  tokenRParen(value: ')'): RParenToken {
    return {
      ...this.defaultTokenFields,
      type: Token.R_PAREN,
      value,
      invalid: this.checkInvalidParen(),
    };
  }

  tokenFreeText(value: string, quoted: boolean): FreeTextToken {
    return {
      ...this.defaultTokenFields,
      type: Token.FREE_TEXT,
      value,
      quoted,
      invalid: this.checkInvalidFreeText(value),
    };
  }

  tokenLogicGroup(inner: ParseResultToken[]): LogicGroupToken {
    return {...this.defaultTokenFields, type: Token.LOGIC_GROUP, inner};
  }

  tokenLogicBoolean(value: BooleanOperator): LogicBooleanToken {
    return {
      ...this.defaultTokenFields,
      type: Token.LOGIC_BOOLEAN,
      value,
      invalid: this.checkInvalidLogicalBoolean(value),
    };
  }

  tokenKeySimple(value: string, quoted: boolean): KeySimpleToken {
    return {
      ...this.defaultTokenFields,
      type: Token.KEY_SIMPLE,
      value,
      quoted,
    };
  }

  tokenKeyExplicitFlag(prefix: string, key: KeySimpleToken): KeyExplicitFlagToken {
    return {
      ...this.defaultTokenFields,
      type: Token.KEY_EXPLICIT_FLAG,
      prefix,
      key,
    };
  }

  tokenKeyExplicitStringFlag(
    prefix: string,
    key: KeySimpleToken
  ): KeyExplicitStringFlagToken {
    return {
      ...this.defaultTokenFields,
      type: Token.KEY_EXPLICIT_STRING_FLAG,
      prefix,
      key,
    };
  }

  tokenKeyExplicitNumberFlag(
    prefix: string,
    key: KeySimpleToken
  ): KeyExplicitNumberFlagToken {
    return {
      ...this.defaultTokenFields,
      type: Token.KEY_EXPLICIT_NUMBER_FLAG,
      prefix,
      key,
    };
  }

  tokenKeyExplicitTag(prefix: string, key: KeySimpleToken): KeyExplicitTagToken {
    return {
      ...this.defaultTokenFields,
      type: Token.KEY_EXPLICIT_TAG,
      prefix,
      key,
    };
  }

  tokenKeyExplicitStringTag(
    prefix: string,
    key: KeySimpleToken
  ): KeyExplicitStringTagToken {
    return {
      ...this.defaultTokenFields,
      type: Token.KEY_EXPLICIT_STRING_TAG,
      prefix,
      key,
    };
  }

  tokenKeyExplicitNumberTag(
    prefix: string,
    key: KeySimpleToken
  ): KeyExplicitNumberTagToken {
    return {
      ...this.defaultTokenFields,
      type: Token.KEY_EXPLICIT_NUMBER_TAG,
      prefix,
      key,
    };
  }

  tokenKeyExplicitBooleanTag(
    prefix: string,
    key: KeySimpleToken
  ): KeyExplicitBooleanTagToken {
    return {
      ...this.defaultTokenFields,
      type: Token.KEY_EXPLICIT_BOOLEAN_TAG,
      prefix,
      key,
    };
  }

  tokenKeyExplicitArrayTag(
    prefix: string,
    key: KeySimpleToken
  ): KeyExplicitArrayTagToken {
    return {
      ...this.defaultTokenFields,
      // The array-includes rule consumes `[*]` around this token, so build the
      // text from the key to keep the tag identity operator-free.
      text: `${prefix}[${key.text},array]`,
      type: Token.KEY_EXPLICIT_ARRAY_TAG,
      prefix,
      key,
    };
  }

  tokenKeyArrayIncludes(
    key: KeySimpleToken | KeyExplicitArrayTagToken,
    index: string
  ): KeyArrayIncludesToken {
    return {
      ...this.defaultTokenFields,
      type: Token.KEY_ARRAY_INCLUDES,
      key,
      index,
    };
  }

  tokenKeyAggregateParam(value: string, quoted: boolean): KeyAggregateParamToken {
    return {
      ...this.defaultTokenFields,
      type: Token.KEY_AGGREGATE_PARAMS,
      value,
      quoted,
    };
  }

  tokenKeyAggregate(
    name: KeySimpleToken,
    args: KeyAggregateArgsToken | null,
    argsSpaceBefore: SpacesToken,
    argsSpaceAfter: SpacesToken
  ): KeyAggregateToken {
    return {
      ...this.defaultTokenFields,
      type: Token.KEY_AGGREGATE,
      name,
      args,
      argsSpaceBefore,
      argsSpaceAfter,
    };
  }

  tokenKeyAggregateArgs(
    arg1: KeyAggregateParamToken,
    args: Array<RawListItem<KeyAggregateParamToken>>
  ): KeyAggregateArgsToken {
    return {
      ...this.defaultTokenFields,
      type: Token.KEY_AGGREGATE_ARGS,
      args: [{separator: '', value: arg1}, ...args.map(joinListItem)],
    };
  }

  tokenValueIso8601Date(
    value: string,
    date: Array<string | string[]>,
    time?: Array<string | string[] | string[][]> | null,
    tz?: Array<string | string[]> | string | null
  ): ValueIso8601DateToken {
    return {
      ...this.defaultTokenFields,
      type: Token.VALUE_ISO_8601_DATE,
      value,
      date: date.flat().join(''),
      time: Array.isArray(time) ? time.flat().flat().join('').replace('T', '') : time,
      tz: Array.isArray(tz) ? tz.flat().join('') : tz,
    };
  }

  tokenValueRelativeDate(
    value: string,
    sign: '-' | '+',
    unit: 'w' | 'd' | 'h' | 'm'
  ): ValueRelativeDateToken {
    return {
      ...this.defaultTokenFields,
      type: Token.VALUE_RELATIVE_DATE,
      value,
      sign,
      unit,
    };
  }

  tokenValueDuration(value: string, unit: string): ValueDurationToken {
    return {
      ...this.defaultTokenFields,
      type: Token.VALUE_DURATION,
      value,
      unit,
    };
  }

  tokenValueSize(value: string, unit: string): ValueSizeToken {
    return {...this.defaultTokenFields, type: Token.VALUE_SIZE, value, unit};
  }

  tokenValuePercentage(value: string): ValuePercentageToken {
    return {...this.defaultTokenFields, type: Token.VALUE_PERCENTAGE, value};
  }

  tokenValueBoolean(value: string): ValueBooleanToken {
    return {...this.defaultTokenFields, type: Token.VALUE_BOOLEAN, value};
  }

  tokenValueNumber(value: string, unit: string | null): ValueNumberToken {
    return {
      ...this.defaultTokenFields,
      type: Token.VALUE_NUMBER,
      value,
      unit,
    };
  }

  tokenValueNumberList(
    item1: ValueNumberToken,
    items: Array<RawListItem<ValueNumberToken>>
  ): ValueNumberListToken {
    return {
      ...this.defaultTokenFields,
      type: Token.VALUE_NUMBER_LIST,
      items: [{separator: '', value: item1}, ...items.map(joinListItem)],
    };
  }

  tokenValueTextList(
    item1: ValueTextToken,
    items: Array<RawListItem<ValueTextToken>>
  ): ValueTextListToken {
    return {
      ...this.defaultTokenFields,
      type: Token.VALUE_TEXT_LIST,
      items: [{separator: '', value: item1}, ...items.map(joinListItem)],
    };
  }

  tokenValueText(value: string, quoted: boolean): ValueTextToken {
    return {
      ...this.defaultTokenFields,
      type: Token.VALUE_TEXT,
      value,
      quoted,
    };
  }

  // -- Grammar predicates -------------------------------------------------

  /**
   * Whether a typed filter rule may match this key. Keys that fail every
   * typed rule fall through to a text filter.
   */
  predicateFilter(type: FilterType, key: KeyToken): boolean {
    const keyName = getKeyName(key);
    const checkAggregate = (check: (name: string) => boolean): boolean =>
      key.type === Token.KEY_AGGREGATE &&
      (key.args?.args.some(arg => check(arg.value?.value ?? '')) ?? false);

    switch (type) {
      case FilterType.NUMERIC:
      case FilterType.NUMERIC_IN:
        return this.isNumericKey(keyName);
      case FilterType.DURATION:
        return this.isDurationKey(keyName);
      case FilterType.SIZE:
        return this.isSizeKey(keyName);
      case FilterType.BOOLEAN:
        return this.isBooleanKey(keyName);
      case FilterType.DATE:
      case FilterType.RELATIVE_DATE:
      case FilterType.SPECIFIC_DATE:
        return this.isDateKey(keyName);
      case FilterType.AGGREGATE_DURATION:
        return checkAggregate(name => this.isDurationKey(name));
      // Size values only make sense when an argument is a size key, like the
      // other typed aggregates (see getsentry/toolkit#1533).
      case FilterType.AGGREGATE_SIZE:
        return checkAggregate(name => this.isSizeKey(name));
      case FilterType.AGGREGATE_DATE:
        return checkAggregate(name => this.isDateKey(name));
      case FilterType.AGGREGATE_PERCENTAGE:
        return checkAggregate(name => this.isPercentageKey(name));
      default:
        return true;
    }
  }

  /** Whether a text filter on this key may carry a comparison operator. */
  predicateTextOperator(key: KeyToken): boolean {
    return this.config.textOperatorKeys.has(getKeyName(key));
  }

  /** Whether to build {@link LogicGroupToken}s for parenthesized terms. */
  predicateParenGroup(): boolean {
    return !this.config.flattenParenGroups;
  }
}

export type TokenConverterClass<C extends SearchConfig> = new (
  options: ConverterOptions<C>
) => TokenConverter<C>;

/** Thrown by {@link parseSearchOrThrow} when a query does not parse. */
export type SearchSyntaxError = Error & {
  found: string | null;
  location: SourceLocation;
};

/**
 * Apply `overrides` onto `base`, skipping `undefined` values so an unset
 * override never clears a default.
 */
function mergeSearchConfig<C extends SearchConfig>(base: C, overrides: Partial<C>): C {
  return {
    ...base,
    ...Object.fromEntries(
      Object.entries(overrides).filter(([, value]) => value !== undefined)
    ),
  };
}

type ParseSearchOptions<C extends SearchConfig> = {
  /** Overrides applied onto {@link defaultConfig}. */
  config?: Partial<C>;
  /** A converter subclass, e.g. one that adds validation. */
  converter?: TokenConverterClass<C>;
};

/**
 * Parse a Sentry search query. Throws a {@link SearchSyntaxError} when the
 * query does not match the grammar.
 */
export function parseSearchOrThrow<C extends SearchConfig = SearchConfig>(
  query: string,
  options: ParseSearchOptions<C> = {}
): ParseResult {
  const base = defaultConfig as C;
  const config = options.config ? mergeSearchConfig(base, options.config) : base;
  return parseGrammar(query, {
    config,
    TokenConverter: options.converter ?? TokenConverter,
    TermOperator,
    FilterType,
  });
}

/**
 * Parse a Sentry search query, or return `null` when it does not match the
 * grammar. Mirrors the frontend's `parseSearch`.
 */
export function parseSearch<C extends SearchConfig = SearchConfig>(
  query: string,
  options: ParseSearchOptions<C> = {}
): ParseResult | null {
  try {
    return parseSearchOrThrow(query, options);
  } catch {
    return null;
  }
}
