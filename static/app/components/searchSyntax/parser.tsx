import moment from 'moment';
import {LocationRange} from 'pegjs';

import grammar from './grammar.pegjs';

type TextFn = () => string;
type LocationFn = () => LocationRange;

type ListItem<K> = [
  space: ReturnType<TokenConverter['tokenSpaces']>,
  comma: string,
  space: ReturnType<TokenConverter['tokenSpaces']>,
  key: K
];

const listJoiner = <K,>([s1, comma, s2, value]: ListItem<K>) => ({
  separator: [s1.value, comma, s2.value].join(''),
  value,
});

/**
 * A token represents a node in the syntax tree. These are all extrapolated
 * from the grammar and may not be named exactly the same.
 */
export enum Token {
  Spaces = 'spaces',
  Filter = 'filter',
  FreeText = 'freeText',
  LogicGroup = 'logicGroup',
  LogicBoolean = 'logicBoolean',
  KeySimple = 'keySimple',
  KeyExplicitTag = 'keyExplicitTag',
  KeyAggregate = 'keyAggregate',
  KeyAggregateArgs = 'keyAggregateArgs',
  ValueIso8601Date = 'valueIso8601Date',
  ValueRelativeDate = 'valueRelativeDate',
  ValueDuration = 'valueDuration',
  ValuePercentage = 'valuePercentage',
  ValueBoolean = 'valueBoolean',
  ValueNumber = 'valueNumber',
  ValueText = 'valueText',
  ValueNumberList = 'valueNumberList',
  ValueTextList = 'valueTextList',
}

/**
 * An operator in a key value term
 */
export enum TermOperator {
  Default = '',
  GreaterThanEqual = '>=',
  LessThanEqual = '<=',
  GreaterThan = '>',
  LessThan = '<',
  Equal = '=',
  NotEqual = '!=',
}

/**
 * Logic operators
 */
export enum BooleanOperator {
  And = 'AND',
  Or = 'OR',
}

/**
 * The Token.Filter may be one of many types of filters. This enum declares the
 * each variant filter type.
 */
export enum FilterType {
  Text = 'text',
  TextIn = 'textIn',
  Date = 'date',
  SpecificDate = 'specificDate',
  RelativeDate = 'relativeDate',
  Duration = 'duration',
  Numeric = 'numeric',
  NumericIn = 'numericIn',
  Boolean = 'boolean',
  AggregateSimple = 'aggregateSimple',
  AggregateDate = 'aggregateDate',
  AggregateRelativeDate = 'aggregateRelativeDate',
  Has = 'has',
  Is = 'is',
}

const allOperators = [
  TermOperator.Default,
  TermOperator.GreaterThanEqual,
  TermOperator.LessThanEqual,
  TermOperator.GreaterThan,
  TermOperator.LessThan,
  TermOperator.Equal,
  TermOperator.NotEqual,
] as const;

const textKeys = [Token.KeySimple, Token.KeyExplicitTag] as const;

const numberUnits = {
  b: 1_000_000_000,
  m: 1_000_000,
  k: 1_000,
};

/**
 * This constant-type configuration object declares how each filter type
 * operates. Including what types of keys, operators, and values it may
 * recieve.
 *
 * This configuration is used to generate the discriminate Filter type that is
 * returned from the tokenFilter converter.
 */
export const filterTypeConfig = {
  [FilterType.Text]: {
    validKeys: textKeys,
    validOps: [],
    validValues: [Token.ValueText],
    canNegate: true,
  },
  [FilterType.TextIn]: {
    validKeys: textKeys,
    validOps: [],
    validValues: [Token.ValueTextList],
    canNegate: true,
  },
  [FilterType.Date]: {
    validKeys: [Token.KeySimple],
    validOps: allOperators,
    validValues: [Token.ValueIso8601Date],
    canNegate: false,
  },
  [FilterType.SpecificDate]: {
    validKeys: [Token.KeySimple],
    validOps: [],
    validValues: [Token.ValueIso8601Date],
    canNegate: false,
  },
  [FilterType.RelativeDate]: {
    validKeys: [Token.KeySimple],
    validOps: [],
    validValues: [Token.ValueRelativeDate],
    canNegate: false,
  },
  [FilterType.Duration]: {
    validKeys: [Token.KeySimple],
    validOps: allOperators,
    validValues: [Token.ValueDuration],
    canNegate: false,
  },
  [FilterType.Numeric]: {
    validKeys: [Token.KeySimple],
    validOps: allOperators,
    validValues: [Token.ValueNumber],
    canNegate: false,
  },
  [FilterType.NumericIn]: {
    validKeys: [Token.KeySimple],
    validOps: [],
    validValues: [Token.ValueNumberList],
    canNegate: false,
  },
  [FilterType.Boolean]: {
    validKeys: [Token.KeySimple],
    validOps: [],
    validValues: [Token.ValueBoolean],
    canNegate: true,
  },
  [FilterType.AggregateSimple]: {
    validKeys: [Token.KeyAggregate],
    validOps: allOperators,
    validValues: [Token.ValueDuration, Token.ValueNumber, Token.ValuePercentage],
    canNegate: true,
  },
  [FilterType.AggregateDate]: {
    validKeys: [Token.KeyAggregate],
    validOps: allOperators,
    validValues: [Token.ValueIso8601Date],
    canNegate: true,
  },
  [FilterType.AggregateRelativeDate]: {
    validKeys: [Token.KeyAggregate],
    validOps: allOperators,
    validValues: [Token.ValueRelativeDate],
    canNegate: true,
  },
  [FilterType.Has]: {
    validKeys: [Token.KeySimple],
    validOps: [],
    validValues: [],
    canNegate: true,
  },
  [FilterType.Is]: {
    validKeys: [Token.KeySimple],
    validOps: [],
    validValues: [Token.ValueText],
    canNegate: true,
  },
} as const;

type FilterTypeConfig = typeof filterTypeConfig;

type FilterMap = {
  [F in keyof FilterTypeConfig]: {
    type: Token.Filter;
    filter: F;
    config: FilterTypeConfig[F];
    key: KVConverter<FilterTypeConfig[F]['validKeys'][number]>;
    value: KVConverter<FilterTypeConfig[F]['validValues'][number]>;
    operator: FilterTypeConfig[F]['validOps'][number];
    negated: FilterTypeConfig[F]['canNegate'] extends true ? boolean : false;
  };
};

/**
 * The Filter type discriminates on the FilterType enum using the `filter` key.
 *
 * When receiving this type you may narrow it to a specific filter by checking
 * this field. This will give you proper types on what the key, value, and
 * operator results are.
 */
type FilterResult = FilterMap[FilterType];

/**
 * Used to construct token results via the token grammar
 */
class TokenConverter {
  text: TextFn;
  location: LocationFn;

  constructor(text: TextFn, location: LocationFn) {
    this.text = text;
    this.location = location;
  }

  /**
   * Creates a token with common `text` and `location` keys.
   */
  makeToken = <T,>(args: T) => ({
    text: this.text(),
    location: this.location(),
    ...args,
  });

  tokenSpaces = (value: string) =>
    this.makeToken({
      type: Token.Spaces as const,
      value,
    });

  tokenFilter = <T extends FilterType>(
    type: T,
    key: FilterMap[T]['key'],
    value: FilterMap[T]['value'],
    operator: FilterMap[T]['operator'] | undefined,
    negated: FilterMap[T]['negated']
  ) =>
    this.makeToken({
      type: Token.Filter,
      filter: type,
      config: filterTypeConfig[type],
      negated,
      key,
      operator: operator ?? TermOperator.Default,
      value,
    } as FilterResult);

  tokenFreeText = (value: string, quoted: boolean) =>
    this.makeToken({
      type: Token.FreeText as const,
      value,
      quoted,
    });

  tokenLogicGroup = (
    inner: Array<
      | ReturnType<TokenConverter['tokenLogicBoolean']>
      | ReturnType<TokenConverter['tokenFilter']>
      | ReturnType<TokenConverter['tokenFreeText']>
    >
  ) =>
    this.makeToken({
      type: Token.LogicGroup as const,
      inner,
    });

  tokenLogicBoolean = (bool: BooleanOperator) =>
    this.makeToken({
      type: Token.LogicBoolean as const,
      value: bool,
    });

  tokenKeySimple = (value: string, quoted: boolean) =>
    this.makeToken({
      type: Token.KeySimple as const,
      value,
      quoted,
    });

  tokenKeyExplicitTag = (
    prefix: string,
    key: ReturnType<TokenConverter['tokenKeySimple']>
  ) =>
    this.makeToken({
      type: Token.KeyExplicitTag as const,
      prefix,
      key,
    });

  tokenKeyAggregate = (
    name: ReturnType<TokenConverter['tokenKeySimple']>,
    args: ReturnType<TokenConverter['tokenKeyAggregateArgs']> | null,
    argsSpaceBefore: ReturnType<TokenConverter['tokenSpaces']>,
    argsSpaceAfter: ReturnType<TokenConverter['tokenSpaces']>
  ) =>
    this.makeToken({
      type: Token.KeyAggregate as const,
      name,
      args,
      argsSpaceBefore,
      argsSpaceAfter,
    });

  tokenKeyAggregateArgs = (
    arg1: ReturnType<TokenConverter['tokenKeySimple']>,
    args: ListItem<ReturnType<TokenConverter['tokenKeySimple']>>[]
  ) =>
    this.makeToken({
      type: Token.KeyAggregateArgs as const,
      args: [{separator: '', value: arg1}, ...args.map(listJoiner)],
    });

  tokenValueIso8601Date = (value: string) =>
    this.makeToken({
      type: Token.ValueIso8601Date as const,
      value: moment(value),
    });

  tokenValueRelativeDate = (
    value: string,
    sign: '-' | '+',
    unit: 'w' | 'd' | 'h' | 'm'
  ) =>
    this.makeToken({
      type: Token.ValueRelativeDate as const,
      value: Number(value),
      sign,
      unit,
    });

  tokenValueDuration = (
    value: string,
    unit: 'ms' | 's' | 'min' | 'm' | 'hr' | 'h' | 'day' | 'd' | 'wk' | 'w'
  ) =>
    this.makeToken({
      type: Token.ValueDuration as const,
      value: Number(value),
      unit,
    });

  tokenValuePercentage = (value: string) =>
    this.makeToken({
      type: Token.ValuePercentage as const,
      value: Number(value),
    });

  tokenValueBoolean = (value: string) =>
    this.makeToken({
      type: Token.ValueBoolean as const,
      value: ['1', 'true'].includes(value.toLowerCase()),
    });

  tokenValueNumber = (value: string, unit: string) =>
    this.makeToken({
      type: Token.ValueNumber as const,
      value,
      rawValue: Number(value) * (numberUnits[unit] ?? 1),
      unit,
    });

  tokenValueText = (value: string, quoted: boolean) =>
    this.makeToken({
      type: Token.ValueText as const,
      value,
      quoted,
    });

  tokenValueNumberList = (
    item1: ReturnType<TokenConverter['tokenValueNumber']>,
    items: ListItem<ReturnType<TokenConverter['tokenValueNumber']>>[]
  ) =>
    this.makeToken({
      type: Token.ValueNumberList as const,
      items: [{separator: '', value: item1}, ...items.map(listJoiner)],
    });

  tokenValueTextList = (
    item1: ReturnType<TokenConverter['tokenValueText']>,
    items: ListItem<ReturnType<TokenConverter['tokenValueText']>>[]
  ) =>
    this.makeToken({
      type: Token.ValueTextList as const,
      items: [{separator: '', value: item1}, ...items.map(listJoiner)],
    });
}

/**
 * Maps token conversion methods to their result types
 */
type ConverterResultMap = {
  [K in keyof TokenConverter & `token${string}`]: ReturnType<TokenConverter[K]>;
};

type Converter = keyof ConverterResultMap;

/**
 * Converter keys specific to Key and Value tokens
 */
type KVTokens = Converter & `token${'Key' | 'Value'}${string}`;

/**
 * Similar to TokenResult, but only includes Key* and Value* token type
 * results. This avoids a circular reference when this is used for the Filter
 * token converter result
 */
type KVConverter<T extends Token> = ConverterResultMap[KVTokens] & {type: T};

/**
 * Each token type is discriminated by the `type` field.
 */
export type TokenResult<T extends Token> = ConverterResultMap[Converter] & {type: T};

/**
 * Result from parsing a search query.
 */
export type ParseResult = Array<
  | TokenResult<Token.LogicBoolean>
  | TokenResult<Token.LogicGroup>
  | TokenResult<Token.Filter>
  | TokenResult<Token.FreeText>
  | TokenResult<Token.Spaces>
>;

const options = {
  TokenConverter,
  TermOperator,
  FilterType,
};

export function parseSearch(query: string): ParseResult {
  return grammar.parse(query, options);
}
