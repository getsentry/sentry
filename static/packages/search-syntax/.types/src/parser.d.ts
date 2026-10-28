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
export type SpacesToken = BaseToken<Token.SPACES> & {
  value: string;
};
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
export type ListItem<V> = {
  separator: string;
  value: V | null;
};
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
export declare const defaultConfig: SearchConfig;
type GetKeyNameOptions = {
  /** Include the arguments of aggregate keys, e.g. `p95(span.duration)`. */
  aggregateWithArgs?: boolean;
};
/** The key name the API expects for a filter key. Matches the frontend. */
export declare function getKeyName(key: KeyToken, options?: GetKeyNameOptions): string;
type RawListItem<V> = [
  space1: SpacesToken,
  comma: string,
  space2: SpacesToken,
  value?: [notComma: undefined, value: V | null] | null,
];
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
export declare class TokenConverter<C extends SearchConfig = SearchConfig> {
  protected readonly text: () => string;
  protected readonly location: () => SourceLocation;
  protected readonly config: C;
  constructor({text, location, config}: ConverterOptions<C>);
  protected get defaultTokenFields(): {
    location: SourceLocation;
    text: string;
  };
  isNumericKey(key: string): boolean;
  isBooleanKey(key: string): boolean;
  isPercentageKey(key: string): boolean;
  isDateKey(key: string): boolean;
  isDurationKey(key: string): boolean;
  isSizeKey(key: string): boolean;
  checkInvalidFilter(
    _filter: FilterType,
    _key: KeyToken,
    _value: FilterToken['value'],
    _negated: boolean,
    _operator: TermOperator
  ): InvalidToken;
  checkInvalidFreeText(_value: string): InvalidToken;
  checkInvalidLogicalBoolean(_value: BooleanOperator): InvalidToken;
  checkInvalidParen(): InvalidToken;
  tokenSpaces(value: string): SpacesToken;
  tokenFilter(
    filter: FilterType,
    key: KeyToken,
    value: FilterToken['value'],
    operator: TermOperator | undefined | null,
    negated: boolean,
    wildcard?: TermOperator
  ): FilterToken;
  tokenRegexFilter(
    key: KeyToken,
    literal: ValueTextToken,
    pattern: ValueTextToken,
    negated: boolean
  ): FilterToken;
  tokenLParen(value: '('): LParenToken;
  tokenRParen(value: ')'): RParenToken;
  tokenFreeText(value: string, quoted: boolean): FreeTextToken;
  tokenLogicGroup(inner: ParseResultToken[]): LogicGroupToken;
  tokenLogicBoolean(value: BooleanOperator): LogicBooleanToken;
  tokenKeySimple(value: string, quoted: boolean): KeySimpleToken;
  tokenKeyExplicitFlag(prefix: string, key: KeySimpleToken): KeyExplicitFlagToken;
  tokenKeyExplicitStringFlag(
    prefix: string,
    key: KeySimpleToken
  ): KeyExplicitStringFlagToken;
  tokenKeyExplicitNumberFlag(
    prefix: string,
    key: KeySimpleToken
  ): KeyExplicitNumberFlagToken;
  tokenKeyExplicitTag(prefix: string, key: KeySimpleToken): KeyExplicitTagToken;
  tokenKeyExplicitStringTag(
    prefix: string,
    key: KeySimpleToken
  ): KeyExplicitStringTagToken;
  tokenKeyExplicitNumberTag(
    prefix: string,
    key: KeySimpleToken
  ): KeyExplicitNumberTagToken;
  tokenKeyExplicitBooleanTag(
    prefix: string,
    key: KeySimpleToken
  ): KeyExplicitBooleanTagToken;
  tokenKeyExplicitArrayTag(prefix: string, key: KeySimpleToken): KeyExplicitArrayTagToken;
  tokenKeyArrayIncludes(
    key: KeySimpleToken | KeyExplicitArrayTagToken,
    index: string
  ): KeyArrayIncludesToken;
  tokenKeyAggregateParam(value: string, quoted: boolean): KeyAggregateParamToken;
  tokenKeyAggregate(
    name: KeySimpleToken,
    args: KeyAggregateArgsToken | null,
    argsSpaceBefore: SpacesToken,
    argsSpaceAfter: SpacesToken
  ): KeyAggregateToken;
  tokenKeyAggregateArgs(
    arg1: KeyAggregateParamToken,
    args: Array<RawListItem<KeyAggregateParamToken>>
  ): KeyAggregateArgsToken;
  tokenValueIso8601Date(
    value: string,
    date: Array<string | string[]>,
    time?: Array<string | string[] | string[][]> | null,
    tz?: Array<string | string[]> | string | null
  ): ValueIso8601DateToken;
  tokenValueRelativeDate(
    value: string,
    sign: '-' | '+',
    unit: 'w' | 'd' | 'h' | 'm'
  ): ValueRelativeDateToken;
  tokenValueDuration(value: string, unit: string): ValueDurationToken;
  tokenValueSize(value: string, unit: string): ValueSizeToken;
  tokenValuePercentage(value: string): ValuePercentageToken;
  tokenValueBoolean(value: string): ValueBooleanToken;
  tokenValueNumber(value: string, unit: string | null): ValueNumberToken;
  tokenValueNumberList(
    item1: ValueNumberToken,
    items: Array<RawListItem<ValueNumberToken>>
  ): ValueNumberListToken;
  tokenValueTextList(
    item1: ValueTextToken,
    items: Array<RawListItem<ValueTextToken>>
  ): ValueTextListToken;
  tokenValueText(value: string, quoted: boolean): ValueTextToken;
  /**
   * Whether a typed filter rule may match this key. Keys that fail every
   * typed rule fall through to a text filter.
   */
  predicateFilter(type: FilterType, key: KeyToken): boolean;
  /** Whether a text filter on this key may carry a comparison operator. */
  predicateTextOperator(key: KeyToken): boolean;
  /** Whether to build {@link LogicGroupToken}s for parenthesized terms. */
  predicateParenGroup(): boolean;
}
export type TokenConverterClass<C extends SearchConfig> = new (
  options: ConverterOptions<C>
) => TokenConverter<C>;
/** Thrown by {@link parseSearchOrThrow} when a query does not parse. */
export type SearchSyntaxError = Error & {
  found: string | null;
  location: SourceLocation;
};
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
export declare function parseSearchOrThrow<C extends SearchConfig = SearchConfig>(
  query: string,
  options?: ParseSearchOptions<C>
): ParseResult;
/**
 * Parse a Sentry search query, or return `null` when it does not match the
 * grammar. Mirrors the frontend's `parseSearch`.
 */
export declare function parseSearch<C extends SearchConfig = SearchConfig>(
  query: string,
  options?: ParseSearchOptions<C>
): ParseResult | null;
export {};
//# sourceMappingURL=parser.d.ts.map
