/**
 * A token represents a node in the syntax tree. This file is written by hand,
 * not generated: the names follow the rules in `grammar.pegjs` but may not
 * match them exactly.
 */
export enum Token {
  SPACES = 'spaces',
  FILTER = 'filter',
  FREE_TEXT = 'freeText',
  LOGIC_GROUP = 'logicGroup',
  LOGIC_BOOLEAN = 'logicBoolean',
  KEY_SIMPLE = 'keySimple',
  KEY_EXPLICIT_FLAG = 'keyExplicitFlag',
  KEY_EXPLICIT_NUMBER_FLAG = 'keyExplicitNumberFlag',
  KEY_EXPLICIT_STRING_FLAG = 'keyExplicitStringFlag',
  KEY_EXPLICIT_TAG = 'keyExplicitTag',
  KEY_EXPLICIT_BOOLEAN_TAG = 'keyExplicitBooleanTag',
  KEY_EXPLICIT_NUMBER_TAG = 'keyExplicitNumberTag',
  KEY_EXPLICIT_STRING_TAG = 'keyExplicitStringTag',
  KEY_EXPLICIT_ARRAY_TAG = 'keyExplicitArrayTag',
  KEY_ARRAY_INCLUDES = 'keyArrayIncludes',
  KEY_AGGREGATE = 'keyAggregate',
  KEY_AGGREGATE_ARGS = 'keyAggregateArgs',
  KEY_AGGREGATE_PARAMS = 'keyAggregateParam',
  L_PAREN = 'lParen',
  R_PAREN = 'rParen',
  VALUE_ISO_8601_DATE = 'valueIso8601Date',
  VALUE_RELATIVE_DATE = 'valueRelativeDate',
  VALUE_DURATION = 'valueDuration',
  VALUE_SIZE = 'valueSize',
  VALUE_PERCENTAGE = 'valuePercentage',
  VALUE_BOOLEAN = 'valueBoolean',
  VALUE_NUMBER = 'valueNumber',
  VALUE_TEXT = 'valueText',
  VALUE_NUMBER_LIST = 'valueNumberList',
  VALUE_TEXT_LIST = 'valueTextList',
}

/**
 * An operator in a key value term
 */
export enum TermOperator {
  DEFAULT = '',
  GREATER_THAN_EQUAL = '>=',
  LESS_THAN_EQUAL = '<=',
  GREATER_THAN = '>',
  LESS_THAN = '<',
  EQUAL = '=',
  NOT_EQUAL = '!=',
  // NOTE: These wildcard operators are internal implementation details and
  // should not be included in product docs. Users should use `*` instead.
  CONTAINS = '\uF00DContains\uF00D',
  DOES_NOT_CONTAIN = '\uF00DDoesNotContain\uF00D',
  STARTS_WITH = '\uF00DStartsWith\uF00D',
  DOES_NOT_START_WITH = '\uF00DDoesNotStartWith\uF00D',
  ENDS_WITH = '\uF00DEndsWith\uF00D',
  DOES_NOT_END_WITH = '\uF00DDoesNotEndWith\uF00D',
  MATCHES = '//',
  DOES_NOT_MATCH = '!//',
}

/**
 * The internal "contains", "starts with" and "ends with" operators for text
 * filters, and their negations. The query builder writes them as a
 * `\uF00D`-delimited marker before the value, e.g.
 * `message:\uF00DContains\uF00Dtimeout`, and the parser turns the marker
 * into the filter's operator. They are not user-facing syntax: `*` wildcards
 * that users type stay in the value text.
 */
export const wildcardOperators = [
  TermOperator.CONTAINS,
  TermOperator.DOES_NOT_CONTAIN,
  TermOperator.STARTS_WITH,
  TermOperator.DOES_NOT_START_WITH,
  TermOperator.ENDS_WITH,
  TermOperator.DOES_NOT_END_WITH,
] as const;

/** One of {@link wildcardOperators}. */
export type WildcardOperator = (typeof wildcardOperators)[number];

/**
 * The operators for regex filters such as `foo://^ba[rz]$//`. Token
 * converters only use them when the search config sets `allowRegex`;
 * otherwise the value is literal text.
 */
export const regexOperators = [
  TermOperator.MATCHES,
  TermOperator.DOES_NOT_MATCH,
] as const;

/** One of {@link regexOperators}. */
export type RegexOperator = (typeof regexOperators)[number];

/**
 * The boolean operators that join search terms, e.g. `a:1 OR b:2`. They are
 * case-insensitive in queries and normalized to upper case in
 * {@link Token.LOGIC_BOOLEAN} tokens. Terms separated only by spaces are
 * implicitly joined with `AND`.
 */
export enum BooleanOperator {
  AND = 'AND',
  OR = 'OR',
}

/**
 * The kind of a {@link Token.FILTER} token, which decides how its value is
 * parsed. The grammar picks a typed filter (date, duration, numeric, ...) when
 * the token converter's predicates accept the key, and falls back to `TEXT`.
 */
export enum FilterType {
  TEXT = 'text',
  TEXT_IN = 'textIn',
  DATE = 'date',
  SPECIFIC_DATE = 'specificDate',
  RELATIVE_DATE = 'relativeDate',
  DURATION = 'duration',
  SIZE = 'size',
  NUMERIC = 'numeric',
  NUMERIC_IN = 'numericIn',
  BOOLEAN = 'boolean',
  AGGREGATE_DURATION = 'aggregateDuration',
  AGGREGATE_SIZE = 'aggregateSize',
  AGGREGATE_PERCENTAGE = 'aggregatePercentage',
  AGGREGATE_NUMERIC = 'aggregateNumeric',
  AGGREGATE_DATE = 'aggregateDate',
  AGGREGATE_RELATIVE_DATE = 'aggregateRelativeDate',
  HAS = 'has',
  IS = 'is',
  ARRAY_INCLUDES = 'arrayIncludes',
}
