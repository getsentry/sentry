import type {LocationRange} from 'peggy';

export type TextFn = () => string;
export type LocationFn = () => LocationRange;
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
}
export enum BooleanOperator {
  AND = 'AND',
  OR = 'OR',
}
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
}
export enum WildcardOperators {
  CONTAINS = '\uF00DContains\uF00D',
  STARTS_WITH = '\uF00DStartsWith\uF00D',
  ENDS_WITH = '\uF00DEndsWith\uF00D',
}
export enum InvalidReason {
  FREE_TEXT_NOT_ALLOWED = 'free-text-not-allowed',
  WILDCARD_NOT_ALLOWED = 'wildcard-not-allowed',
  LOGICAL_OR_NOT_ALLOWED = 'logic-or-not-allowed',
  LOGICAL_AND_NOT_ALLOWED = 'logic-and-not-allowed',
  NEGATION_NOT_ALLOWED = 'negation-not-allowed',
  MUST_BE_QUOTED = 'must-be-quoted',
  FILTER_MUST_HAVE_VALUE = 'filter-must-have-value',
  INVALID_BOOLEAN = 'invalid-boolean',
  INVALID_FILE_SIZE = 'invalid-file-size',
  INVALID_NUMBER = 'invalid-number',
  EMPTY_VALUE_IN_LIST_NOT_ALLOWED = 'empty-value-in-list-not-allowed',
  EMPTY_PARAMETER_NOT_ALLOWED = 'empty-parameter-not-allowed',
  INVALID_KEY = 'invalid-key',
  INVALID_DURATION = 'invalid-duration',
  INVALID_DATE_FORMAT = 'invalid-date-format',
  PARENS_NOT_ALLOWED = 'parens-not-allowed',
}
export type InvalidFilter = {
  /**
   * The message indicating why the filter is invalid
   */
  reason: string;
  /**
   * The invalid reason type
   */
  type: InvalidReason;
  /**
   * In the case where a filter is invalid, we may be expecting a different
   * type for this filter based on the key. This can be useful to hint to the
   * user what values they should be providing.
   *
   * This may be multiple filter types.
   */
  expectedType?: FilterType[];
};
