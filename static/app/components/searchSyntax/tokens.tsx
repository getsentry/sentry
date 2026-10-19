/**
 * A token represents a node in the syntax tree. These are all extrapolated
 * from the grammar and may not be named exactly the same.
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

export const wildcardOperators = [
  TermOperator.CONTAINS,
  TermOperator.DOES_NOT_CONTAIN,
  TermOperator.STARTS_WITH,
  TermOperator.DOES_NOT_START_WITH,
  TermOperator.ENDS_WITH,
  TermOperator.DOES_NOT_END_WITH,
] as const;

export type WildcardOperator = (typeof wildcardOperators)[number];

export const regexOperators = [
  TermOperator.MATCHES,
  TermOperator.DOES_NOT_MATCH,
] as const;

export type RegexOperator = (typeof regexOperators)[number];
