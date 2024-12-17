import * as Sentry from '@sentry/react';
import merge from 'lodash/merge';
import moment from 'moment-timezone';
import type {LocationRange} from 'peggy';

import {t} from 'sentry/locale';
import type {TagCollection} from 'sentry/types/group';
import {
  isMeasurement,
  isSpanOperationBreakdownField,
  measurementType,
} from 'sentry/utils/discover/fields';

import grammar from './grammar.pegjs';
import {getKeyName} from './utils';

type TextFn = () => string;
type LocationFn = () => LocationRange;

type ListItem<V> = [
  space: ReturnType<TokenConverter['tokenSpaces']>,
  comma: string,
  space: ReturnType<TokenConverter['tokenSpaces']>,
  value?: [notComma: undefined, value: V | null],
];

const listJoiner = <K,>([s1, comma, s2, value]: ListItem<K>) => {
  return {
    separator: [s1.value, comma, s2.value].join(''),
    value: value ? value[1] : null,
  };
};

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
  KEY_EXPLICIT_TAG = 'keyExplicitTag',
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
}

/**
 * Logic operators
 */
export enum BooleanOperator {
  AND = 'AND',
  OR = 'OR',
}

/**
 * The Token.Filter may be one of many types of filters. This enum declares the
 * each variant filter type.
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
}

export const allOperators = [
  TermOperator.DEFAULT,
  TermOperator.GREATER_THAN_EQUAL,
  TermOperator.LESS_THAN_EQUAL,
  TermOperator.GREATER_THAN,
  TermOperator.LESS_THAN,
  TermOperator.EQUAL,
  TermOperator.NOT_EQUAL,
] as const;

const basicOperators = [TermOperator.DEFAULT, TermOperator.NOT_EQUAL] as const;

/**
 * Map of certain filter types to other filter types with applicable operators
 * e.g. SpecificDate can use the operators from Date to become a Date filter.
 */
export const interchangeableFilterOperators = {
  [FilterType.SPECIFIC_DATE]: [FilterType.DATE],
  [FilterType.DATE]: [FilterType.SPECIFIC_DATE],
};

const textKeys = [Token.KEY_SIMPLE, Token.KEY_EXPLICIT_TAG] as const;

/**
 * This constant-type configuration object declares how each filter type
 * operates. Including what types of keys, operators, and values it may
 * receive.
 *
 * This configuration is used to generate the discriminate Filter type that is
 * returned from the tokenFilter converter.
 */
export const filterTypeConfig = {
  [FilterType.TEXT]: {
    validKeys: textKeys,
    validOps: basicOperators,
    validValues: [Token.VALUE_TEXT],
    canNegate: true,
  },
  [FilterType.TEXT_IN]: {
    validKeys: textKeys,
    validOps: basicOperators,
    validValues: [Token.VALUE_TEXT_LIST],
    canNegate: true,
  },
  [FilterType.DATE]: {
    validKeys: [Token.KEY_SIMPLE],
    validOps: allOperators,
    validValues: [Token.VALUE_ISO_8601_DATE],
    canNegate: false,
  },
  [FilterType.SPECIFIC_DATE]: {
    validKeys: [Token.KEY_SIMPLE],
    validOps: [],
    validValues: [Token.VALUE_ISO_8601_DATE],
    canNegate: false,
  },
  [FilterType.RELATIVE_DATE]: {
    validKeys: [Token.KEY_SIMPLE],
    validOps: [],
    validValues: [Token.VALUE_RELATIVE_DATE],
    canNegate: false,
  },
  [FilterType.DURATION]: {
    validKeys: [Token.KEY_SIMPLE],
    validOps: allOperators,
    validValues: [Token.VALUE_DURATION],
    canNegate: true,
  },
  [FilterType.SIZE]: {
    validKeys: [Token.KEY_SIMPLE],
    validOps: allOperators,
    validValues: [Token.VALUE_SIZE],
    canNegate: true,
  },
  [FilterType.NUMERIC]: {
    validKeys: [Token.KEY_SIMPLE],
    validOps: allOperators,
    validValues: [Token.VALUE_NUMBER],
    canNegate: true,
  },
  [FilterType.NUMERIC_IN]: {
    validKeys: [Token.KEY_SIMPLE],
    validOps: basicOperators,
    validValues: [Token.VALUE_NUMBER_LIST],
    canNegate: true,
  },
  [FilterType.BOOLEAN]: {
    validKeys: [Token.KEY_SIMPLE],
    validOps: basicOperators,
    validValues: [Token.VALUE_BOOLEAN],
    canNegate: true,
  },
  [FilterType.AGGREGATE_DURATION]: {
    validKeys: [Token.KEY_AGGREGATE],
    validOps: allOperators,
    validValues: [Token.VALUE_DURATION],
    canNegate: true,
  },
  [FilterType.AGGREGATE_SIZE]: {
    validKeys: [Token.KEY_AGGREGATE],
    validOps: allOperators,
    validValues: [Token.VALUE_SIZE],
    canNegate: true,
  },
  [FilterType.AGGREGATE_NUMERIC]: {
    validKeys: [Token.KEY_AGGREGATE],
    validOps: allOperators,
    validValues: [Token.VALUE_NUMBER],
    canNegate: true,
  },
  [FilterType.AGGREGATE_PERCENTAGE]: {
    validKeys: [Token.KEY_AGGREGATE],
    validOps: allOperators,
    validValues: [Token.VALUE_PERCENTAGE],
    canNegate: true,
  },
  [FilterType.AGGREGATE_DATE]: {
    validKeys: [Token.KEY_AGGREGATE],
    validOps: allOperators,
    validValues: [Token.VALUE_ISO_8601_DATE],
    canNegate: true,
  },
  [FilterType.AGGREGATE_RELATIVE_DATE]: {
    validKeys: [Token.KEY_AGGREGATE],
    validOps: allOperators,
    validValues: [Token.VALUE_RELATIVE_DATE],
    canNegate: true,
  },
  [FilterType.HAS]: {
    validKeys: [Token.KEY_SIMPLE],
    validOps: basicOperators,
    validValues: [],
    canNegate: true,
  },
  [FilterType.IS]: {
    validKeys: [Token.KEY_SIMPLE],
    validOps: basicOperators,
    validValues: [Token.VALUE_TEXT],
    canNegate: true,
  },
} as const;

type FilterTypeConfig = typeof filterTypeConfig;

/**
 * The invalid reason is used to mark fields invalid fields and can be
 * used to determine why the field was invalid. This is primarily use for the
 * invalidMessages option
 */
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

/**
 * Object representing an invalid filter state
 */
type InvalidFilter = {
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

type FilterMap = {
  [F in keyof FilterTypeConfig]: {
    /**
     * The filter type being represented
     */
    filter: F;
    /**
     * When a filter is marked as 'invalid' a reason is given. If the filter is
     * not invalid this will always be null
     */
    invalid: InvalidFilter | null;
    /**
     * The key of the filter
     */
    key: KVConverter<FilterTypeConfig[F]['validKeys'][number]>;
    /**
     * Indicates if the filter has been negated
     */
    negated: FilterTypeConfig[F]['canNegate'] extends true ? boolean : false;
    /**
     * The operator applied to the filter
     */
    operator: FilterTypeConfig[F]['validOps'][number];
    type: Token.FILTER;
    /**
     * The value of the filter
     */
    value: KVConverter<FilterTypeConfig[F]['validValues'][number]>;
    /**
     * A warning message associated with this filter
     */
    warning: React.ReactNode;
  };
};

type TextFilter = FilterMap[FilterType.TEXT];
type InFilter = FilterMap[FilterType.TEXT_IN] | FilterMap[FilterType.NUMERIC_IN];
type AggregateFilterType =
  | FilterMap[FilterType.AGGREGATE_DATE]
  | FilterMap[FilterType.AGGREGATE_DURATION]
  | FilterMap[FilterType.AGGREGATE_NUMERIC]
  | FilterMap[FilterType.AGGREGATE_PERCENTAGE]
  | FilterMap[FilterType.AGGREGATE_RELATIVE_DATE]
  | FilterMap[FilterType.AGGREGATE_SIZE];

/**
 * The Filter type discriminates on the FilterType enum using the `filter` key.
 *
 * When receiving this type you may narrow it to a specific filter by checking
 * this field. This will give you proper types on what the key, value, and
 * operator results are.
 */
type FilterResult = FilterMap[FilterType];

type TokenConverterOpts = {
  config: SearchConfig;
  location: LocationFn;
  text: TextFn;
};

/**
 * Used to construct token results via the token grammar
 */
export class TokenConverter {
  text: TextFn;
  location: LocationFn;
  config: SearchConfig;

  constructor({text, location, config}: TokenConverterOpts) {
    this.text = text;
    this.location = location;
    this.config = config;
  }

  /**
   * Validates various types of keys
   */
  keyValidation = {
    isNumeric: (key: string) =>
      this.config.numericKeys.has(key) ||
      isMeasurement(key) ||
      isSpanOperationBreakdownField(key),
    isBoolean: (key: string) => this.config.booleanKeys.has(key),
    isPercentage: (key: string) => this.config.percentageKeys.has(key),
    isDate: (key: string) => this.config.dateKeys.has(key),
    isDuration: (key: string) =>
      this.config.durationKeys.has(key) ||
      isSpanOperationBreakdownField(key) ||
      measurementType(key) === 'duration',
    isSize: (key: string) => this.config.sizeKeys.has(key),
  };

  /**
   * Creates shared `text` and `location` keys.
   */
  get defaultTokenFields() {
    return {
      text: this.text(),
      location: this.location(),
    };
  }

  tokenSpaces = (value: string) => ({
    ...this.defaultTokenFields,
    type: Token.SPACES as const,
    value,
  });

  tokenFilter = <T extends FilterType>(
    filter: T,
    key: FilterMap[T]['key'],
    value: FilterMap[T]['value'],
    operator: FilterMap[T]['operator'] | undefined,
    negated: FilterMap[T]['negated']
  ) => {
    const filterToken = {
      type: Token.FILTER as const,
      filter,
      key,
      value,
      negated,
      operator: operator ?? TermOperator.DEFAULT,
      invalid: this.checkInvalidFilter(filter, key, value, negated),
      warning: this.checkFilterWarning(key),
    } as FilterResult;

    return {
      ...this.defaultTokenFields,
      ...filterToken,
    };
  };

  tokenLParen = (value: '(') => ({
    ...this.defaultTokenFields,
    type: Token.L_PAREN as const,
    value,
    invalid: this.checkInvalidParen(),
  });

  tokenRParen = (value: ')') => ({
    ...this.defaultTokenFields,
    type: Token.R_PAREN as const,
    value,
    invalid: this.checkInvalidParen(),
  });

  tokenFreeText = (value: string, quoted: boolean) => ({
    ...this.defaultTokenFields,
    type: Token.FREE_TEXT as const,
    value,
    quoted,
    invalid: this.checkInvalidFreeText(value),
  });

  tokenLogicGroup = (
    inner: Array<
      | ReturnType<TokenConverter['tokenLogicBoolean']>
      | ReturnType<TokenConverter['tokenFilter']>
      | ReturnType<TokenConverter['tokenFreeText']>
    >
  ) => ({
    ...this.defaultTokenFields,
    type: Token.LOGIC_GROUP as const,
    inner,
  });

  tokenLogicBoolean = (bool: BooleanOperator) => ({
    ...this.defaultTokenFields,
    type: Token.LOGIC_BOOLEAN as const,
    value: bool,
    invalid: this.checkInvalidLogicalBoolean(bool),
  });

  tokenKeySimple = (value: string, quoted: boolean) => ({
    ...this.defaultTokenFields,
    type: Token.KEY_SIMPLE as const,
    value,
    quoted,
  });

  tokenKeyExplicitTag = (
    prefix: string,
    key: ReturnType<TokenConverter['tokenKeySimple']>
  ) => ({
    ...this.defaultTokenFields,
    type: Token.KEY_EXPLICIT_TAG as const,
    prefix,
    key,
  });

  tokenKeyAggregateParam = (value: string, quoted: boolean) => ({
    ...this.defaultTokenFields,
    type: Token.KEY_AGGREGATE_PARAMS as const,
    value,
    quoted,
  });

  tokenKeyAggregate = (
    name: ReturnType<TokenConverter['tokenKeySimple']>,
    args: ReturnType<TokenConverter['tokenKeyAggregateArgs']> | null,
    argsSpaceBefore: ReturnType<TokenConverter['tokenSpaces']>,
    argsSpaceAfter: ReturnType<TokenConverter['tokenSpaces']>
  ) => ({
    ...this.defaultTokenFields,
    type: Token.KEY_AGGREGATE as const,
    name,
    args,
    argsSpaceBefore,
    argsSpaceAfter,
  });

  tokenKeyAggregateArgs = (
    arg1: ReturnType<TokenConverter['tokenKeyAggregateParam']>,
    args: ListItem<ReturnType<TokenConverter['tokenKeyAggregateParam']>>[]
  ) => {
    return {
      ...this.defaultTokenFields,
      type: Token.KEY_AGGREGATE_ARGS as const,
      args: [{separator: '', value: arg1}, ...args.map(listJoiner)],
    };
  };

  tokenValueIso8601Date = (
    value: string,
    date: Array<string | string[]>,
    time?: Array<string | string[] | Array<string[]>>,
    tz?: Array<string | string[]>
  ) => ({
    ...this.defaultTokenFields,
    type: Token.VALUE_ISO_8601_DATE as const,
    value,
    parsed: this.config.parse ? parseDate(value) : undefined,
    date: date.flat().join(''),
    time: Array.isArray(time) ? time.flat().flat().join('').replace('T', '') : time,
    tz: Array.isArray(tz) ? tz.flat().join('') : tz,
  });

  tokenValueRelativeDate = (
    value: string,
    sign: '-' | '+',
    unit: 'w' | 'd' | 'h' | 'm'
  ) => ({
    ...this.defaultTokenFields,
    type: Token.VALUE_RELATIVE_DATE as const,
    value,
    parsed: this.config.parse ? parseRelativeDate(value, {unit, sign}) : undefined,
    sign,
    unit,
  });

  tokenValueDuration = (
    value: string,
    unit: 'ms' | 's' | 'min' | 'm' | 'hr' | 'h' | 'day' | 'd' | 'wk' | 'w'
  ) => ({
    ...this.defaultTokenFields,

    type: Token.VALUE_DURATION as const,
    value,
    parsed: this.config.parse ? parseDuration(value, unit) : undefined,
    unit,
  });

  tokenValueSize = (
    value: string,
    // warning: size units are case insensitive, this type is incomplete
    unit:
      | 'bit'
      | 'nb'
      | 'bytes'
      | 'kb'
      | 'mb'
      | 'gb'
      | 'tb'
      | 'pb'
      | 'eb'
      | 'zb'
      | 'yb'
      | 'kib'
      | 'mib'
      | 'gib'
      | 'tib'
      | 'pib'
      | 'eib'
      | 'zib'
      | 'yib'
  ) => ({
    ...this.defaultTokenFields,
    type: Token.VALUE_SIZE as const,
    value,
    // units are case insensitive, normalize them in their parsed representation
    // so that we dont have to compare all possible permutations.
    parsed: this.config.parse ? parseSize(value, unit) : undefined,
    unit,
  });

  tokenValuePercentage = (value: string) => ({
    ...this.defaultTokenFields,
    type: Token.VALUE_PERCENTAGE as const,
    value,
    parsed: this.config.parse ? parsePercentage(value) : undefined,
  });

  tokenValueBoolean = (value: string) => ({
    ...this.defaultTokenFields,
    type: Token.VALUE_BOOLEAN as const,
    value,
    parsed: this.config.parse ? parseBoolean(value) : undefined,
  });

  tokenValueNumber = (value: string, unit: 'k' | 'm' | 'b' | 'K' | 'M' | 'B') => {
    return {
      ...this.defaultTokenFields,
      type: Token.VALUE_NUMBER as const,
      value,
      unit,
      parsed: this.config.parse ? parseNumber(value, unit) : undefined,
    };
  };

  tokenValueNumberList = (
    item1: ReturnType<TokenConverter['tokenValueNumber']>,
    items: ListItem<ReturnType<TokenConverter['tokenValueNumber']>>[]
  ) => ({
    ...this.defaultTokenFields,
    type: Token.VALUE_NUMBER_LIST as const,
    items: [{separator: '', value: item1}, ...items.map(listJoiner)],
  });

  tokenValueTextList = (
    item1: ReturnType<TokenConverter['tokenValueText']>,
    items: ListItem<ReturnType<TokenConverter['tokenValueText']>>[]
  ) => ({
    ...this.defaultTokenFields,
    type: Token.VALUE_TEXT_LIST as const,
    items: [{separator: '', value: item1}, ...items.map(listJoiner)],
  });

  tokenValueText = (value: string, quoted: boolean) => {
    return {
      ...this.defaultTokenFields,
      type: Token.VALUE_TEXT as const,
      value,
      quoted,
    };
  };

  /**
   * This method is used while tokenizing to predicate whether a filter should
   * match or not. We do this because not all keys are valid for specific
   * filter types. For example, boolean filters should only match for keys
   * which can be filtered as booleans.
   *
   * See [0] and look for &{ predicate } to understand how predicates are
   * declared in the grammar
   *
   * [0]:https://pegjs.org/documentation
   */
  predicateFilter = <T extends FilterType>(type: T, key: FilterMap[T]['key']) => {
    const keyName = getKeyName(key);
    const aggregateKey = key as ReturnType<TokenConverter['tokenKeyAggregate']>;

    const {isNumeric, isDuration, isBoolean, isDate, isPercentage, isSize} =
      this.keyValidation;

    const checkAggregate = (check: (s: string) => boolean) =>
      aggregateKey.args?.args.some(arg => check(arg?.value?.value ?? ''));

    switch (type) {
      case FilterType.NUMERIC:
      case FilterType.NUMERIC_IN:
        return isNumeric(keyName);

      case FilterType.DURATION:
        return isDuration(keyName);

      case FilterType.SIZE:
        return isSize(keyName);

      case FilterType.BOOLEAN:
        return isBoolean(keyName);

      case FilterType.DATE:
      case FilterType.RELATIVE_DATE:
      case FilterType.SPECIFIC_DATE:
        return isDate(keyName);

      case FilterType.AGGREGATE_DURATION:
        return checkAggregate(isDuration);

      case FilterType.AGGREGATE_DATE:
        return checkAggregate(isDate);

      case FilterType.AGGREGATE_PERCENTAGE:
        return checkAggregate(isPercentage);

      default:
        return true;
    }
  };

  /**
   * Predicates weather a text filter have operators for specific keys.
   */
  predicateTextOperator = (key: TextFilter['key']) =>
    this.config.textOperatorKeys.has(getKeyName(key));

  /**
   * When flattenParenGroups is enabled, paren groups should not be parsed,
   * instead parsing the parens and inner group as individual tokens.
   */
  predicateParenGroup = (): boolean => {
    return !this.config.flattenParenGroups;
  };

  /**
   * Checks the validity of a free text based on the provided search configuration
   */
  checkInvalidFreeText = (value: string) => {
    if (this.config.disallowFreeText) {
      return {
        type: InvalidReason.FREE_TEXT_NOT_ALLOWED,
        reason: this.config.invalidMessages[InvalidReason.FREE_TEXT_NOT_ALLOWED],
      };
    }
    if (this.config.disallowWildcard && value.includes('*')) {
      return {
        type: InvalidReason.WILDCARD_NOT_ALLOWED,
        reason: this.config.invalidMessages[InvalidReason.WILDCARD_NOT_ALLOWED],
      };
    }

    return null;
  };

  /**
   * Checks the validity of a logical boolean filter based on the provided search configuration
   */
  checkInvalidLogicalBoolean = (value: BooleanOperator) => {
    if (this.config.disallowedLogicalOperators.has(value)) {
      if (value === BooleanOperator.OR) {
        return {
          type: InvalidReason.LOGICAL_OR_NOT_ALLOWED,
          reason: this.config.invalidMessages[InvalidReason.LOGICAL_OR_NOT_ALLOWED],
        };
      }
      if (value === BooleanOperator.AND) {
        return {
          type: InvalidReason.LOGICAL_AND_NOT_ALLOWED,
          reason: this.config.invalidMessages[InvalidReason.LOGICAL_AND_NOT_ALLOWED],
        };
      }
    }

    return null;
  };

  /**
   * Checks the validity of a parens based on the provided search configuration
   */
  checkInvalidParen = () => {
    if (!this.config.disallowParens) {
      return null;
    }

    return {
      type: InvalidReason.PARENS_NOT_ALLOWED,
      reason: this.config.invalidMessages[InvalidReason.PARENS_NOT_ALLOWED],
    };
  };

  /**
   * Checks a filter against some non-grammar validation rules
   */
  checkFilterWarning = <T extends FilterType>(key: FilterMap[T]['key']) => {
    if (
      ![Token.KEY_SIMPLE, Token.KEY_EXPLICIT_TAG, Token.KEY_AGGREGATE].includes(key.type)
    ) {
      return null;
    }

    const keyName = getKeyName(
      key as TokenResult<Token.KEY_SIMPLE | Token.KEY_EXPLICIT_TAG>
    );
    return this.config.getFilterTokenWarning?.(keyName) ?? null;
  };

  /**
   * Checks a filter against some non-grammar validation rules
   */
  checkInvalidFilter = <T extends FilterType>(
    filter: T,
    key: FilterMap[T]['key'],
    value: FilterMap[T]['value'],
    negated: FilterMap[T]['negated']
  ) => {
    // Text filter is the "fall through" filter that will match when other
    // filter predicates fail.
    if (
      this.config.validateKeys &&
      this.config.supportedTags &&
      !this.config.supportedTags[getKeyName(key)]
    ) {
      return {
        type: InvalidReason.INVALID_KEY,
        reason: t('Invalid key. "%s" is not a supported search key.', key.text),
      };
    }

    if (this.config.disallowNegation && negated) {
      return {
        type: InvalidReason.NEGATION_NOT_ALLOWED,
        reason: this.config.invalidMessages[InvalidReason.NEGATION_NOT_ALLOWED],
      };
    }

    if (filter === FilterType.TEXT) {
      return this.checkInvalidTextFilter(
        key as TextFilter['key'],
        value as TextFilter['value']
      );
    }

    if (filter === FilterType.IS || filter === FilterType.HAS) {
      return this.checkInvalidTextValue(value as TextFilter['value']);
    }

    if ([FilterType.TEXT_IN, FilterType.NUMERIC_IN].includes(filter)) {
      return this.checkInvalidInFilter(value as InFilter['value']);
    }

    if ('name' in key) {
      return this.checkInvalidAggregateKey(key);
    }

    return null;
  };

  /**
   * Validates text filters which may have failed predication
   */
  checkInvalidTextFilter = (key: TextFilter['key'], value: TextFilter['value']) => {
    // Explicit tag keys will always be treated as text filters
    if (key.type === Token.KEY_EXPLICIT_TAG) {
      return this.checkInvalidTextValue(value);
    }

    const keyName = getKeyName(key);

    if (this.keyValidation.isDuration(keyName)) {
      return {
        type: InvalidReason.INVALID_DURATION,
        reason: t('Invalid duration. Expected number followed by duration unit suffix'),
        expectedType: [FilterType.DURATION],
      };
    }

    if (this.keyValidation.isDate(keyName)) {
      const date = new Date();
      date.setSeconds(0);
      date.setMilliseconds(0);
      const example = date.toISOString();

      return {
        type: InvalidReason.INVALID_DATE_FORMAT,
        reason: t(
          'Invalid date format. Expected +/-duration (e.g. +1h) or ISO 8601-like (e.g. %s or %s)',
          example.slice(0, 10),
          example
        ),
        expectedType: [
          FilterType.DATE,
          FilterType.SPECIFIC_DATE,
          FilterType.RELATIVE_DATE,
        ],
      };
    }

    if (this.keyValidation.isBoolean(keyName)) {
      return {
        type: InvalidReason.INVALID_BOOLEAN,
        reason: this.config.invalidMessages[InvalidReason.INVALID_BOOLEAN],
        expectedType: [FilterType.BOOLEAN],
      };
    }

    if (this.keyValidation.isSize(keyName)) {
      return {
        type: InvalidReason.INVALID_FILE_SIZE,
        reason: this.config.invalidMessages[InvalidReason.INVALID_FILE_SIZE],
        expectedType: [FilterType.SIZE],
      };
    }

    if (this.keyValidation.isNumeric(keyName)) {
      return {
        type: InvalidReason.INVALID_NUMBER,
        reason: this.config.invalidMessages[InvalidReason.INVALID_NUMBER],
        expectedType: [FilterType.NUMERIC, FilterType.NUMERIC_IN],
      };
    }

    return this.checkInvalidTextValue(value);
  };

  /**
   * Validates the value of a text filter
   */
  checkInvalidTextValue = (value: TextFilter['value']) => {
    if (this.config.disallowWildcard && value.value.includes('*')) {
      return {
        type: InvalidReason.WILDCARD_NOT_ALLOWED,
        reason: this.config.invalidMessages[InvalidReason.WILDCARD_NOT_ALLOWED],
      };
    }

    if (!value.quoted && /(^|[^\\])"/.test(value.value)) {
      return {
        type: InvalidReason.MUST_BE_QUOTED,
        reason: this.config.invalidMessages[InvalidReason.MUST_BE_QUOTED],
      };
    }

    if (!value.quoted && value.value === '') {
      return {
        type: InvalidReason.FILTER_MUST_HAVE_VALUE,
        reason: this.config.invalidMessages[InvalidReason.FILTER_MUST_HAVE_VALUE],
      };
    }

    return null;
  };

  /**
   * Validates IN filter values do not have an missing elements
   */
  checkInvalidInFilter = ({items}: InFilter['value']) => {
    const hasEmptyValue = items.some(item => item.value === null);

    if (hasEmptyValue) {
      return {
        type: InvalidReason.EMPTY_VALUE_IN_LIST_NOT_ALLOWED,
        reason:
          this.config.invalidMessages[InvalidReason.EMPTY_VALUE_IN_LIST_NOT_ALLOWED],
      };
    }

    if (
      this.config.disallowWildcard &&
      items.some(item => item.value.value.includes('*'))
    ) {
      return {
        type: InvalidReason.WILDCARD_NOT_ALLOWED,
        reason: this.config.invalidMessages[InvalidReason.WILDCARD_NOT_ALLOWED],
      };
    }

    return null;
  };

  checkInvalidAggregateKey = (key: AggregateFilterType['key']) => {
    const hasEmptyParameter = key.args?.args.some(arg => arg.value === null);

    if (hasEmptyParameter) {
      return {
        type: InvalidReason.EMPTY_PARAMETER_NOT_ALLOWED,
        reason: this.config.invalidMessages[InvalidReason.EMPTY_PARAMETER_NOT_ALLOWED],
      };
    }

    return null;
  };
}

function parseDate(input: string): {value: Date} {
  const date = moment(input).toDate();

  if (isNaN(date.getTime())) {
    throw new Error('Invalid date');
  }

  return {value: date};
}

function parseRelativeDate(
  input: string,
  {sign, unit}: {sign: '-' | '+'; unit: string}
): {value: Date} {
  let date = new Date().getTime();
  const number = numeric(input);

  if (isNaN(date)) {
    throw new Error('Invalid date');
  }

  let offset: number | undefined;
  switch (unit) {
    case 'm':
      offset = number * 1000 * 60;
      break;
    case 'h':
      offset = number * 1000 * 60 * 60;
      break;
    case 'd':
      offset = number * 1000 * 60 * 60 * 24;
      break;
    case 'w':
      offset = number * 1000 * 60 * 60 * 24 * 7;
      break;
    default:
      throw new Error('Invalid unit');
  }

  if (offset === undefined) {
    throw new Error('Unreachable');
  }

  date = sign === '-' ? date - offset : date + offset;
  return {value: new Date(date)};
}

// The parser supports floats and ints, parseFloat handles both.
function numeric(input: string) {
  const number = parseFloat(input);
  if (isNaN(number)) {
    throw new Error('Invalid number');
  }
  return number;
}

function parseDuration(
  input: string,
  unit: 'ms' | 's' | 'min' | 'm' | 'hr' | 'h' | 'day' | 'd' | 'wk' | 'w'
): {value: number} {
  let number = numeric(input);

  switch (unit) {
    case 'ms':
      break;
    case 's':
      number *= 1e3;
      break;
    case 'min':
    case 'm':
      number *= 1e3 * 60;
      break;
    case 'hr':
    case 'h':
      number *= 1e3 * 60 * 60;
      break;
    case 'day':
    case 'd':
      number *= 1e3 * 60 * 60 * 24;
      break;
    case 'wk':
    case 'w':
      number *= 1e3 * 60 * 60 * 24 * 7;
      break;
    default:
      throw new Error('Invalid unit');
  }

  return {
    value: number,
  };
}
function parseNumber(
  input: string,
  unit: 'k' | 'm' | 'b' | 'K' | 'M' | 'B'
): {value: number} {
  let number = numeric(input);

  switch (unit) {
    case 'K':
    case 'k':
      number = number * 1e3;
      break;
    case 'M':
    case 'm':
      number = number * 1e6;
      break;
    case 'B':
    case 'b':
      number = number * 1e9;
      break;
    case null:
    case undefined:
      break;
    default:
      throw new Error('Invalid unit');
  }

  return {value: number};
}
function parseSize(input: string, unit: string): {value: number} {
  if (!unit) {
    unit = 'bytes';
  }

  let number = numeric(input);

  // parser is case insensitive to units
  switch (unit.toLowerCase()) {
    case 'bit':
      number /= 8;
      break;
    case 'nb':
      number /= 2;
      break;
    case 'bytes':
      break;
    case 'kb':
      number *= 1000;
      break;
    case 'mb':
      number *= 1000 ** 2;
      break;
    case 'gb':
      number *= 1000 ** 3;
      break;
    case 'tb':
      number *= 1000 ** 4;
      break;
    case 'pb':
      number *= 1000 ** 5;
      break;
    case 'eb':
      number *= 1000 ** 6;
      break;
    case 'zb':
      number *= 1000 ** 7;
      break;
    case 'yb':
      number *= 1000 ** 8;
      break;
    case 'kib':
      number *= 1024;
      break;
    case 'mib':
      number *= 1024 ** 2;
      break;
    case 'gib':
      number *= 1024 ** 3;
      break;
    case 'tib':
      number *= 1024 ** 4;
      break;
    case 'pib':
      number *= 1024 ** 5;
      break;
    case 'eib':
      number *= 1024 ** 6;
      break;
    case 'zib':
      number *= 1024 ** 7;
      break;
    case 'yib':
      number *= 1024 ** 8;
      break;
    default:
      throw new Error('Invalid unit');
  }

  return {value: number};
}
function parsePercentage(input: string): {value: number} {
  return {value: numeric(input)};
}
function parseBoolean(input: string): {value: boolean} {
  if (/^true$/i.test(input) || input === '1') {
    return {value: true};
  }
  if (/^false$/i.test(input) || input === '0') {
    return {value: false};
  }
  throw new Error('Invalid boolean');
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

export type ParseResultToken =
  | TokenResult<Token.LOGIC_BOOLEAN>
  | TokenResult<Token.LOGIC_GROUP>
  | TokenResult<Token.FILTER>
  | TokenResult<Token.FREE_TEXT>
  | TokenResult<Token.SPACES>
  | TokenResult<Token.L_PAREN>
  | TokenResult<Token.R_PAREN>;

/**
 * Result from parsing a search query.
 */
export type ParseResult = ParseResultToken[];

export type AggregateFilter = AggregateFilterType & {
  location: LocationRange;
  text: string;
};

/**
 * Configures behavior of search parsing
 */
export type SearchConfig = {
  /**
   * Keys considered valid for boolean filter types
   */
  booleanKeys: Set<string>;
  /**
   * Keys considered valid for date filter types
   */
  dateKeys: Set<string>;
  /**
   * Disallow free text search
   */
  disallowFreeText: boolean;
  /**
   * Disallow negation for filters
   */
  disallowNegation: boolean;
  /**
   * Disallow parens in search
   */
  disallowParens: boolean;
  /**
   * Disallow wildcards in free text search AND in tag values
   */
  disallowWildcard: boolean;
  /**
   * Disallow specific boolean operators
   */
  disallowedLogicalOperators: Set<BooleanOperator>;
  /**
   * Keys which are considered valid for duration filters
   */
  durationKeys: Set<string>;
  /**
   * Configures the associated messages for invalid reasons
   */
  invalidMessages: Partial<Record<InvalidReason, string>>;
  /**
   * Keys considered valid for numeric filter types
   */
  numericKeys: Set<string>;
  /**
   * Keys considered valid for the percentage aggregate and may have percentage
   * search values
   */
  percentageKeys: Set<string>;
  /**
   * Keys considered valid for size filter types
   */
  sizeKeys: Set<string>;
  /**
   * Text filter keys we allow to have operators
   */
  textOperatorKeys: Set<string>;
  /**
   * When true, the parser will not parse paren groups and will return individual paren tokens
   */
  flattenParenGroups?: boolean;
  /**
   * A function that returns a warning message for a given filter token key
   */
  getFilterTokenWarning?: (key: string) => React.ReactNode;
  /**
   * Determines if user input values should be parsed
   */
  parse?: boolean;
  /**
   * If validateKeys is set to true, tag keys that don't exist in supportedTags will be consider invalid
   */
  supportedTags?: TagCollection;
  /**
   * If set to true, tag keys that don't exist in supportedTags will be consider invalid
   */
  validateKeys?: boolean;
};

export const defaultConfig: SearchConfig = {
  textOperatorKeys: new Set([
    'release.version',
    'release.build',
    'release.package',
    'release.stage',
  ]),
  durationKeys: new Set(['transaction.duration']),
  percentageKeys: new Set(['percentage']),
  // do not put functions in this Set
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
  ]),
  sizeKeys: new Set([]),
  disallowedLogicalOperators: new Set(),
  disallowFreeText: false,
  disallowWildcard: false,
  disallowNegation: false,
  disallowParens: false,
  invalidMessages: {
    [InvalidReason.FREE_TEXT_NOT_ALLOWED]: t('Free text is not supported in this search'),
    [InvalidReason.WILDCARD_NOT_ALLOWED]: t('Wildcards not supported in search'),
    [InvalidReason.LOGICAL_OR_NOT_ALLOWED]: t(
      'The OR operator is not allowed in this search'
    ),
    [InvalidReason.LOGICAL_AND_NOT_ALLOWED]: t(
      'The AND operator is not allowed in this search'
    ),
    [InvalidReason.MUST_BE_QUOTED]: t('Quotes must enclose text or be escaped'),
    [InvalidReason.NEGATION_NOT_ALLOWED]: t('Negation is not allowed in this search.'),
    [InvalidReason.FILTER_MUST_HAVE_VALUE]: t('Filter must have a value'),
    [InvalidReason.INVALID_BOOLEAN]: t('Invalid boolean. Expected true, 1, false, or 0.'),
    [InvalidReason.INVALID_FILE_SIZE]: t(
      'Invalid file size. Expected number followed by file size unit suffix'
    ),
    [InvalidReason.INVALID_NUMBER]: t(
      'Invalid number. Expected number then optional k, m, or b suffix (e.g. 500k)'
    ),
    [InvalidReason.EMPTY_PARAMETER_NOT_ALLOWED]: t(
      'Function parameters should not have empty values'
    ),
    [InvalidReason.EMPTY_VALUE_IN_LIST_NOT_ALLOWED]: t(
      'Lists should not have empty values'
    ),
    [InvalidReason.PARENS_NOT_ALLOWED]: t('Parentheses are not supported in this search'),
  },
};

function tryParseSearch<T extends {config: SearchConfig}>(
  query: string,
  config: T
): ParseResult | null {
  try {
    return grammar.parse(query, config);
  } catch (e) {
    Sentry.withScope(scope => {
      scope.setFingerprint(['search-syntax-parse-error']);
      scope.setExtra('message', e.message?.slice(-100));
      scope.setExtra('found', e.found);
      Sentry.captureException(e);
    });

    return null;
  }
}

/**
 * Parse a search query into a ParseResult. Failing to parse the search query
 * will result in null.
 */
export function parseSearch(
  query: string,
  additionalConfig?: Partial<SearchConfig>
): ParseResult | null {
  const config = additionalConfig
    ? merge({...defaultConfig}, additionalConfig)
    : defaultConfig;

  return tryParseSearch(query, {
    config,
    TokenConverter,
    TermOperator,
    FilterType,
  });
}

/**
 * Join a parsed query array into a string.
 * Should handle null cases to chain easily with parseSearch.
 * Option to add a leading space when applicable (e.g. to combine with other strings).
 * Option to add a space between elements (e.g. for when no Token.Spaces present).
 */
export function joinQuery(
  parsedTerms: ParseResult | null | undefined,
  leadingSpace?: boolean,
  additionalSpaceBetween?: boolean
): string {
  if (!parsedTerms || !parsedTerms.length) {
    return '';
  }

  return (
    (leadingSpace ? ' ' : '') +
    (parsedTerms.length === 1
      ? parsedTerms[0].text
      : parsedTerms.map(p => p.text).join(additionalSpaceBetween ? ' ' : ''))
  );
}
