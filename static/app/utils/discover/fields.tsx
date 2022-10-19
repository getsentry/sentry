import isEqual from 'lodash/isEqual';

import {RELEASE_ADOPTION_STAGES} from 'sentry/constants';
import {MetricsType, Organization, SelectValue} from 'sentry/types';
import {assert} from 'sentry/types/utils';
import {
  SESSIONS_FIELDS,
  SESSIONS_OPERATIONS,
} from 'sentry/views/dashboardsV2/widgetBuilder/releaseWidget/fields';

import {
  AGGREGATION_FIELDS,
  AggregationKey,
  DISCOVER_FIELDS,
  FieldKey,
  FieldValueType,
  getFieldDefinition,
  MEASUREMENT_FIELDS,
  SpanOpBreakdown,
  WebVital,
} from '../fields';

export type Sort = {
  field: string;
  kind: 'asc' | 'desc';
};

// Contains the URL field value & the related table column width.
// Can be parsed into a Column using explodeField()
export type Field = {
  field: string;
  // When an alias is defined for a field, it will be shown as a column name in the table visualization.
  alias?: string;
  width?: number;
};

// ColumnType is kept as a string literal union instead of an enum due to the countless uses of it and refactoring would take huge effort.
export type ColumnType = `${Exclude<FieldValueType, FieldValueType.NEVER>}`;

export type ColumnValueType = ColumnType | `${FieldValueType.NEVER}`;

export type ParsedFunction = {
  arguments: string[];
  name: string;
};

type ValidateColumnValueFunction = (data: {
  dataType: ColumnType;
  name: string;
}) => boolean;

export type ValidateColumnTypes =
  | ColumnType[]
  | MetricsType[]
  | ValidateColumnValueFunction;

export type AggregateParameter =
  | {
      columnTypes: Readonly<ValidateColumnTypes>;
      kind: 'column';
      required: boolean;
      defaultValue?: string;
    }
  | {
      dataType: ColumnType;
      kind: 'value';
      required: boolean;
      defaultValue?: string;
      placeholder?: string;
    }
  | {
      dataType: string;
      kind: 'dropdown';
      options: SelectValue<string>[];
      required: boolean;
      defaultValue?: string;
      placeholder?: string;
    };

export type AggregationRefinement = string | undefined;

// The parsed result of a Field.
// Functions and Fields are handled as subtypes to enable other
// code to work more simply.
// This type can be converted into a Field.field using generateFieldAsString()
// When an alias is defined for a field, it will be shown as a column name in the table visualization.
export type QueryFieldValue =
  | {
      field: string;
      kind: 'field';
      alias?: string;
    }
  | {
      field: string;
      kind: 'calculatedField';
      alias?: string;
    }
  | {
      field: string;
      kind: 'equation';
      alias?: string;
    }
  | {
      function: [
        AggregationKeyWithAlias,
        string,
        AggregationRefinement,
        AggregationRefinement
      ];
      kind: 'function';
      alias?: string;
    };

// Column is just an alias of a Query value
export type Column = QueryFieldValue;

export type Alignments = 'left' | 'right';

const CONDITIONS_ARGUMENTS: SelectValue<string>[] = [
  {
    label: 'is equal to',
    value: 'equals',
  },
  {
    label: 'is not equal to',
    value: 'notEquals',
  },
  {
    label: 'is less than',
    value: 'less',
  },
  {
    label: 'is greater than',
    value: 'greater',
  },
  {
    label: 'is less than or equal to',
    value: 'lessOrEquals',
  },
  {
    label: 'is greater than or equal to',
    value: 'greaterOrEquals',
  },
];

const WEB_VITALS_QUALITY: SelectValue<string>[] = [
  {
    label: 'good',
    value: 'good',
  },
  {
    label: 'meh',
    value: 'meh',
  },
  {
    label: 'poor',
    value: 'poor',
  },
  {
    label: 'any',
    value: 'any',
  },
];

const getDocsAndOutputType = (key: AggregationKey) => {
  return {
    documentation: AGGREGATION_FIELDS[key].desc,
    outputType: AGGREGATION_FIELDS[key].valueType as AggregationOutputType,
  };
};

// Refer to src/sentry/search/events/fields.py
// Try to keep functions logically sorted, ie. all the count functions are grouped together
export const AGGREGATIONS = {
  [AggregationKey.Count]: {
    ...getDocsAndOutputType(AggregationKey.Count),
    parameters: [],
    isSortable: true,
    multiPlotType: 'area',
  },
  [AggregationKey.CountUnique]: {
    ...getDocsAndOutputType(AggregationKey.CountUnique),
    parameters: [
      {
        kind: 'column',
        columnTypes: ['string', 'integer', 'number', 'duration', 'date', 'boolean'],
        defaultValue: 'user',
        required: true,
      },
    ],
    isSortable: true,
    multiPlotType: 'area',
  },
  [AggregationKey.CountMiserable]: {
    ...getDocsAndOutputType(AggregationKey.CountMiserable),
    getFieldOverrides({parameter}: DefaultValueInputs) {
      if (parameter.kind === 'column') {
        return {defaultValue: 'user'};
      }
      return {
        defaultValue: parameter.defaultValue,
      };
    },
    parameters: [
      {
        kind: 'column',
        columnTypes: validateAllowedColumns(['user']),
        defaultValue: 'user',
        required: true,
      },
      {
        kind: 'value',
        dataType: 'number',
        defaultValue: '300',
        required: true,
      },
    ],
    isSortable: true,
    multiPlotType: 'area',
  },
  [AggregationKey.CountIf]: {
    ...getDocsAndOutputType(AggregationKey.CountIf),
    parameters: [
      {
        kind: 'column',
        columnTypes: validateDenyListColumns(
          ['string', 'duration', 'number'],
          ['id', 'issue', 'user.display']
        ),
        defaultValue: 'transaction.duration',
        required: true,
      },
      {
        kind: 'dropdown',
        options: CONDITIONS_ARGUMENTS,
        dataType: 'string',
        defaultValue: CONDITIONS_ARGUMENTS[0].value,
        required: true,
      },
      {
        kind: 'value',
        dataType: 'string',
        defaultValue: '300',
        required: true,
      },
    ],
    isSortable: true,
    multiPlotType: 'area',
  },
  [AggregationKey.CountWebVitals]: {
    ...getDocsAndOutputType(AggregationKey.CountWebVitals),
    parameters: [
      {
        kind: 'column',
        columnTypes: validateAllowedColumns([
          WebVital.LCP,
          WebVital.FP,
          WebVital.FCP,
          WebVital.FID,
          WebVital.CLS,
        ]),
        defaultValue: WebVital.LCP,
        required: true,
      },
      {
        kind: 'dropdown',
        options: WEB_VITALS_QUALITY,
        dataType: 'string',
        defaultValue: WEB_VITALS_QUALITY[0].value,
        required: true,
      },
    ],
    isSortable: true,
    multiPlotType: 'area',
  },
  [AggregationKey.Eps]: {
    ...getDocsAndOutputType(AggregationKey.Eps),
    parameters: [],
    isSortable: true,
    multiPlotType: 'area',
  },
  [AggregationKey.Epm]: {
    ...getDocsAndOutputType(AggregationKey.Epm),
    parameters: [],
    isSortable: true,
    multiPlotType: 'area',
  },
  [AggregationKey.FailureCount]: {
    ...getDocsAndOutputType(AggregationKey.FailureCount),
    parameters: [],
    isSortable: true,
    multiPlotType: 'line',
  },
  [AggregationKey.Min]: {
    ...getDocsAndOutputType(AggregationKey.Min),
    parameters: [
      {
        kind: 'column',
        columnTypes: validateForNumericAggregate([
          'integer',
          'number',
          'duration',
          'date',
          'percentage',
        ]),
        defaultValue: 'transaction.duration',
        required: true,
      },
    ],
    isSortable: true,
    multiPlotType: 'line',
  },
  [AggregationKey.Max]: {
    ...getDocsAndOutputType(AggregationKey.Max),
    parameters: [
      {
        kind: 'column',
        columnTypes: validateForNumericAggregate([
          'integer',
          'number',
          'duration',
          'date',
          'percentage',
        ]),
        defaultValue: 'transaction.duration',
        required: true,
      },
    ],
    isSortable: true,
    multiPlotType: 'line',
  },
  [AggregationKey.Sum]: {
    ...getDocsAndOutputType(AggregationKey.Sum),
    parameters: [
      {
        kind: 'column',
        columnTypes: validateForNumericAggregate(['duration', 'number', 'percentage']),
        required: true,
        defaultValue: 'transaction.duration',
      },
    ],
    isSortable: true,
    multiPlotType: 'area',
  },
  [AggregationKey.Any]: {
    ...getDocsAndOutputType(AggregationKey.Any),
    parameters: [
      {
        kind: 'column',
        columnTypes: ['string', 'integer', 'number', 'duration', 'date', 'boolean'],
        required: true,
        defaultValue: 'transaction.duration',
      },
    ],
    isSortable: true,
  },
  [AggregationKey.P50]: {
    ...getDocsAndOutputType(AggregationKey.P50),
    parameters: [
      {
        kind: 'column',
        columnTypes: validateForNumericAggregate(['duration', 'number', 'percentage']),
        defaultValue: 'transaction.duration',
        required: false,
      },
    ],
    isSortable: true,
    multiPlotType: 'line',
  },
  [AggregationKey.P75]: {
    ...getDocsAndOutputType(AggregationKey.P75),
    parameters: [
      {
        kind: 'column',
        columnTypes: validateForNumericAggregate(['duration', 'number', 'percentage']),
        defaultValue: 'transaction.duration',
        required: false,
      },
    ],
    isSortable: true,
    multiPlotType: 'line',
  },
  [AggregationKey.P95]: {
    ...getDocsAndOutputType(AggregationKey.P95),
    parameters: [
      {
        kind: 'column',
        columnTypes: validateForNumericAggregate(['duration', 'number', 'percentage']),
        defaultValue: 'transaction.duration',
        required: false,
      },
    ],
    type: [],
    isSortable: true,
    multiPlotType: 'line',
  },
  [AggregationKey.P99]: {
    ...getDocsAndOutputType(AggregationKey.P99),
    parameters: [
      {
        kind: 'column',
        columnTypes: validateForNumericAggregate(['duration', 'number', 'percentage']),
        defaultValue: 'transaction.duration',
        required: false,
      },
    ],
    isSortable: true,
    multiPlotType: 'line',
  },
  [AggregationKey.P100]: {
    ...getDocsAndOutputType(AggregationKey.P100),
    parameters: [
      {
        kind: 'column',
        columnTypes: validateForNumericAggregate(['duration', 'number', 'percentage']),
        defaultValue: 'transaction.duration',
        required: false,
      },
    ],
    isSortable: true,
    multiPlotType: 'line',
  },
  [AggregationKey.Percentile]: {
    ...getDocsAndOutputType(AggregationKey.Percentile),
    parameters: [
      {
        kind: 'column',
        columnTypes: validateForNumericAggregate(['duration', 'number', 'percentage']),
        defaultValue: 'transaction.duration',
        required: true,
      },
      {
        kind: 'value',
        dataType: 'number',
        defaultValue: '0.5',
        required: true,
      },
    ],
    isSortable: true,
    multiPlotType: 'line',
  },
  [AggregationKey.Avg]: {
    ...getDocsAndOutputType(AggregationKey.Avg),
    parameters: [
      {
        kind: 'column',
        columnTypes: validateForNumericAggregate(['duration', 'number', 'percentage']),
        defaultValue: 'transaction.duration',
        required: true,
      },
    ],
    isSortable: true,
    multiPlotType: 'line',
  },
  [AggregationKey.Apdex]: {
    ...getDocsAndOutputType(AggregationKey.Apdex),
    parameters: [
      {
        kind: 'value',
        dataType: 'number',
        defaultValue: '300',
        required: true,
      },
    ],
    isSortable: true,
    multiPlotType: 'line',
  },
  [AggregationKey.UserMisery]: {
    ...getDocsAndOutputType(AggregationKey.UserMisery),
    parameters: [
      {
        kind: 'value',
        dataType: 'number',
        defaultValue: '300',
        required: true,
      },
    ],
    isSortable: true,
    multiPlotType: 'line',
  },
  [AggregationKey.FailureRate]: {
    ...getDocsAndOutputType(AggregationKey.FailureRate),
    parameters: [],
    isSortable: true,
    multiPlotType: 'line',
  },
  [AggregationKey.LastSeen]: {
    ...getDocsAndOutputType(AggregationKey.LastSeen),
    parameters: [],
    isSortable: true,
  },
} as const;

// TPM and TPS are aliases that are only used in Performance
export const ALIASES = {
  tpm: AggregationKey.Epm,
  tps: AggregationKey.Eps,
};

assert(AGGREGATIONS as Readonly<{[key in AggregationKey]: Aggregation}>);

export type AggregationKeyWithAlias = `${AggregationKey}` | keyof typeof ALIASES | '';

export type AggregationOutputType = Extract<
  ColumnType,
  'number' | 'integer' | 'date' | 'duration' | 'percentage' | 'string' | 'size'
>;

export type PlotType = 'bar' | 'line' | 'area';

type DefaultValueInputs = {
  parameter: AggregateParameter;
};

export type Aggregation = {
  /**
   * Can this function be used in a sort result
   */
  isSortable: boolean;
  /**
   * The output type. Null means to inherit from the field.
   */
  outputType: AggregationOutputType | null;
  /**
   * List of parameters for the function.
   */
  parameters: Readonly<AggregateParameter[]>;
  getFieldOverrides?: (
    data: DefaultValueInputs
  ) => Partial<Omit<AggregateParameter, 'kind'>>;
  /**
   * How this function should be plotted when shown in a multiseries result (top5)
   * Optional because some functions cannot be plotted (strings/dates)
   */
  multiPlotType?: PlotType;
};

export const DEPRECATED_FIELDS: string[] = [FieldKey.CULPRIT];

export type FieldTag = {
  key: FieldKey;
  name: FieldKey;
};

export const FIELD_TAGS = Object.freeze(
  Object.fromEntries(DISCOVER_FIELDS.map(item => [item, {key: item, name: item}]))
);

export const SEMVER_TAGS = {
  [FieldKey.RELEASE_VERSION]: {
    key: FieldKey.RELEASE_VERSION,
    name: FieldKey.RELEASE_VERSION,
  },
  [FieldKey.RELEASE_BUILD]: {
    key: FieldKey.RELEASE_BUILD,
    name: FieldKey.RELEASE_BUILD,
  },
  [FieldKey.RELEASE_PACKAGE]: {
    key: FieldKey.RELEASE_PACKAGE,
    name: FieldKey.RELEASE_PACKAGE,
  },
  [FieldKey.RELEASE_STAGE]: {
    key: FieldKey.RELEASE_STAGE,
    name: FieldKey.RELEASE_STAGE,
    predefined: true,
    values: RELEASE_ADOPTION_STAGES,
  },
};

/**
 * Some tag keys should never be formatted as `tag[...]`
 * when used as a filter because they are predefined.
 */
const EXCLUDED_TAG_KEYS = new Set(['release', 'user']);

export function formatTagKey(key: string): string {
  // Some tags may be normalized from context, but not all of them are.
  // This supports a user making a custom tag with the same name as one
  // that comes from context as all of these are also tags.
  if (key in FIELD_TAGS && !EXCLUDED_TAG_KEYS.has(key)) {
    return `tags[${key}]`;
  }
  return key;
}

// Allows for a less strict field key definition in cases we are returning custom strings as fields
export type LooseFieldKey = FieldKey | string | '';

export type MeasurementType =
  | FieldValueType.DURATION
  | FieldValueType.NUMBER
  | FieldValueType.INTEGER
  | FieldValueType.PERCENTAGE;

export function isSpanOperationBreakdownField(field: string) {
  return field.startsWith('spans.');
}

export const SPAN_OP_RELATIVE_BREAKDOWN_FIELD = 'span_ops_breakdown.relative';

export function isRelativeSpanOperationBreakdownField(field: string) {
  return field === SPAN_OP_RELATIVE_BREAKDOWN_FIELD;
}

export const SPAN_OP_BREAKDOWN_FIELDS = Object.values(SpanOpBreakdown);

// This list contains fields/functions that are available with performance-view feature.
export const TRACING_FIELDS = [
  AggregationKey.Avg,
  AggregationKey.Sum,
  FieldKey.TRANSACTION_DURATION,
  FieldKey.TRANSACTION_OP,
  FieldKey.TRANSACTION_STATUS,
  AggregationKey.P50,
  AggregationKey.P75,
  AggregationKey.P95,
  AggregationKey.P99,
  AggregationKey.P100,
  AggregationKey.Percentile,
  AggregationKey.FailureRate,
  AggregationKey.Apdex,
  AggregationKey.CountMiserable,
  AggregationKey.UserMisery,
  AggregationKey.Eps,
  AggregationKey.Epm,
  'team_key_transaction',
  ...Object.keys(MEASUREMENT_FIELDS),
  ...SPAN_OP_BREAKDOWN_FIELDS,
  SPAN_OP_RELATIVE_BREAKDOWN_FIELD,
];

export const MEASUREMENT_PATTERN = /^measurements\.([a-zA-Z0-9-_.]+)$/;
export const SPAN_OP_BREAKDOWN_PATTERN = /^spans\.([a-zA-Z0-9-_.]+)$/;

export function isMeasurement(field: string): boolean {
  const results = field.match(MEASUREMENT_PATTERN);
  return !!results;
}

export function measurementType(field: string): MeasurementType {
  if (MEASUREMENT_FIELDS.hasOwnProperty(field)) {
    return MEASUREMENT_FIELDS[field].valueType as MeasurementType;
  }

  return FieldValueType.NUMBER;
}

export function getMeasurementSlug(field: string): string | null {
  const results = field.match(MEASUREMENT_PATTERN);
  if (results && results.length >= 2) {
    return results[1];
  }
  return null;
}

const AGGREGATE_PATTERN = /^(\w+)\((.*)?\)$/;
// Identical to AGGREGATE_PATTERN, but without the $ for newline, or ^ for start of line
const AGGREGATE_BASE = /(\w+)\((.*)?\)/g;

export function getAggregateArg(field: string): string | null {
  // only returns the first argument if field is an aggregate
  const result = parseFunction(field);

  if (result && result.arguments.length > 0) {
    return result.arguments[0];
  }

  return null;
}

export function parseFunction(field: string): ParsedFunction | null {
  const results = field.match(AGGREGATE_PATTERN);
  if (results && results.length === 3) {
    return {
      name: results[1],
      arguments: parseArguments(results[1], results[2]),
    };
  }

  return null;
}

export function parseArguments(functionText: string, columnText: string): string[] {
  // Some functions take a quoted string for their arguments that may contain commas
  // This function attempts to be identical with the similarly named parse_arguments
  // found in src/sentry/search/events/fields.py
  if (
    (functionText !== 'to_other' &&
      functionText !== 'count_if' &&
      functionText !== 'spans_histogram') ||
    columnText?.length === 0
  ) {
    return columnText ? columnText.split(',').map(result => result.trim()) : [];
  }

  const args: string[] = [];

  let quoted = false;
  let escaped = false;

  let i: number = 0;
  let j: number = 0;

  while (j < columnText.length) {
    if (i === j && columnText[j] === '"') {
      // when we see a quote at the beginning of
      // an argument, then this is a quoted string
      quoted = true;
    } else if (i === j && columnText[j] === ' ') {
      // argument has leading spaces, skip over them
      i += 1;
    } else if (quoted && !escaped && columnText[j] === '\\') {
      // when we see a slash inside a quoted string,
      // the next character is an escape character
      escaped = true;
    } else if (quoted && !escaped && columnText[j] === '"') {
      // when we see a non-escaped quote while inside
      // of a quoted string, we should end it
      quoted = false;
    } else if (quoted && escaped) {
      // when we are inside a quoted string and have
      // begun an escape character, we should end it
      escaped = false;
    } else if (quoted && columnText[j] === ',') {
      // when we are inside a quoted string and see
      // a comma, it should not be considered an
      // argument separator
    } else if (columnText[j] === ',') {
      // when we see a comma outside of a quoted string
      // it is an argument separator
      args.push(columnText.substring(i, j).trim());
      i = j + 1;
    }
    j += 1;
  }

  if (i !== j) {
    // add in the last argument if any
    args.push(columnText.substring(i).trim());
  }

  return args;
}

// `|` is an invalid field character, so it is used to determine whether a field is an equation or not
export const EQUATION_PREFIX = 'equation|';
const EQUATION_ALIAS_PATTERN = /^equation\[(\d+)\]$/;
export const CALCULATED_FIELD_PREFIX = 'calculated|';

export function isEquation(field: string): boolean {
  return field.startsWith(EQUATION_PREFIX);
}

export function isEquationAlias(field: string): boolean {
  return EQUATION_ALIAS_PATTERN.test(field);
}

export function maybeEquationAlias(field: string): boolean {
  return field.includes(EQUATION_PREFIX);
}

export function stripEquationPrefix(field: string): string {
  return field.replace(EQUATION_PREFIX, '');
}

export function getEquationAliasIndex(field: string): number {
  const results = field.match(EQUATION_ALIAS_PATTERN);

  if (results && results.length === 2) {
    return parseInt(results[1], 10);
  }
  return -1;
}

export function getEquation(field: string): string {
  return field.slice(EQUATION_PREFIX.length);
}

export function isAggregateEquation(field: string): boolean {
  const results = field.match(AGGREGATE_BASE);

  return isEquation(field) && results !== null && results.length > 0;
}

export function isLegalEquationColumn(column: Column): boolean {
  // Any isn't allowed in arithmetic
  if (column.kind === 'function' && column.function[0] === 'any') {
    return false;
  }

  const columnType = getColumnType(column);
  return columnType === 'number' || columnType === 'integer' || columnType === 'duration';
}

export function generateAggregateFields(
  organization: Organization,
  eventFields: readonly Field[] | Field[],
  excludeFields: readonly string[] = []
): Field[] {
  const functions = Object.keys(AGGREGATIONS);
  const fields = Object.values(eventFields).map(field => field.field);
  functions.forEach(func => {
    const parameters = AGGREGATIONS[func].parameters.map(param => {
      const overrides = AGGREGATIONS[func].getFieldOverrides;
      if (typeof overrides === 'undefined') {
        return param;
      }
      return {
        ...param,
        ...overrides({parameter: param, organization}),
      };
    });

    if (parameters.every(param => typeof param.defaultValue !== 'undefined')) {
      const newField = `${func}(${parameters
        .map(param => param.defaultValue)
        .join(',')})`;
      if (fields.indexOf(newField) === -1 && excludeFields.indexOf(newField) === -1) {
        fields.push(newField);
      }
    }
  });
  return fields.map(field => ({field})) as Field[];
}

export function isDerivedMetric(field: string): boolean {
  return field.startsWith(CALCULATED_FIELD_PREFIX);
}

export function stripDerivedMetricsPrefix(field: string): string {
  return field.replace(CALCULATED_FIELD_PREFIX, '');
}

export function explodeFieldString(field: string, alias?: string): Column {
  if (isEquation(field)) {
    return {kind: 'equation', field: getEquation(field), alias};
  }

  if (isDerivedMetric(field)) {
    return {kind: 'calculatedField', field: stripDerivedMetricsPrefix(field), alias};
  }

  const results = parseFunction(field);

  if (results) {
    return {
      kind: 'function',
      function: [
        results.name as AggregationKey,
        results.arguments[0] ?? '',
        results.arguments[1] as AggregationRefinement,
        results.arguments[2] as AggregationRefinement,
      ],
      alias,
    };
  }

  return {kind: 'field', field, alias};
}

export function generateFieldAsString(value: QueryFieldValue): string {
  if (value.kind === 'field') {
    return value.field;
  }

  if (value.kind === 'calculatedField') {
    return `${CALCULATED_FIELD_PREFIX}${value.field}`;
  }

  if (value.kind === 'equation') {
    return `${EQUATION_PREFIX}${value.field.trim()}`;
  }

  const aggregation = value.function[0];
  const parameters = value.function.slice(1).filter(i => i);
  return `${aggregation}(${parameters.join(',')})`;
}

export function explodeField(field: Field): Column {
  return explodeFieldString(field.field, field.alias);
}

/**
 * Get the alias that the API results will have for a given aggregate function name
 */
export function getAggregateAlias(field: string): string {
  const result = parseFunction(field);

  if (!result) {
    return field;
  }

  let alias = result.name;

  if (result.arguments.length > 0) {
    alias += '_' + result.arguments.join('_');
  }

  return alias.replace(/[^\w]/g, '_').replace(/^_+/g, '').replace(/_+$/, '');
}

/**
 * Check if a field name looks like an aggregate function or known aggregate alias.
 */
export function isAggregateField(field: string): boolean {
  return parseFunction(field) !== null;
}

export function isAggregateFieldOrEquation(field: string): boolean {
  return isAggregateField(field) || isAggregateEquation(field) || isNumericMetrics(field);
}

/**
 * Temporary hardcoded hack to enable testing derived metrics.
 * Can be removed after we get rid of getAggregateFields
 */
export function isNumericMetrics(field: string): boolean {
  return [
    'session.crash_free_rate',
    'session.crashed',
    'session.errored_preaggregated',
    'session.errored_set',
    'session.init',
  ].includes(field);
}

export function getAggregateFields(fields: string[]): string[] {
  return fields.filter(
    field =>
      isAggregateField(field) || isAggregateEquation(field) || isNumericMetrics(field)
  );
}

export function getColumnsAndAggregates(fields: string[]): {
  aggregates: string[];
  columns: string[];
} {
  const aggregates = getAggregateFields(fields);
  const columns = fields.filter(field => !aggregates.includes(field));
  return {columns, aggregates};
}

export function getColumnsAndAggregatesAsStrings(fields: QueryFieldValue[]): {
  aggregates: string[];
  columns: string[];
  fieldAliases: string[];
} {
  // TODO(dam): distinguish between metrics, derived metrics and tags
  const aggregateFields: string[] = [];
  const nonAggregateFields: string[] = [];
  const fieldAliases: string[] = [];

  for (const field of fields) {
    const fieldString = generateFieldAsString(field);
    if (field.kind === 'function' || field.kind === 'calculatedField') {
      aggregateFields.push(fieldString);
    } else if (field.kind === 'equation') {
      if (isAggregateEquation(fieldString)) {
        aggregateFields.push(fieldString);
      } else {
        nonAggregateFields.push(fieldString);
      }
    } else {
      nonAggregateFields.push(fieldString);
    }

    fieldAliases.push(field.alias ?? '');
  }

  return {aggregates: aggregateFields, columns: nonAggregateFields, fieldAliases};
}

/**
 * Convert a function string into type it will output.
 * This is useful when you need to format values in tooltips,
 * or in series markers.
 */
export function aggregateOutputType(field: string | undefined): AggregationOutputType {
  if (!field) {
    return 'number';
  }
  const result = parseFunction(field);
  if (!result) {
    return 'number';
  }
  const outputType = aggregateFunctionOutputType(result.name, result.arguments[0]);
  if (outputType === null) {
    return 'number';
  }
  return outputType;
}

/**
 * Converts a function string and its first argument into its output type.
 * - If the function has a fixed output type, that will be the result.
 * - If the function does not define an output type, the output type will be equal to
 *   the type of its first argument.
 * - If the function has an optional first argument, and it was not defined, make sure
 *   to use the default argument as the first argument.
 * - If the type could not be determined, return null.
 */
export function aggregateFunctionOutputType(
  funcName: string,
  firstArg: string | undefined
): AggregationOutputType | null {
  const aggregate =
    AGGREGATIONS[ALIASES[funcName] || funcName] ?? SESSIONS_OPERATIONS[funcName];

  // Attempt to use the function's outputType.
  if (aggregate?.outputType) {
    return aggregate.outputType;
  }

  // If the first argument is undefined and it is not required,
  // then we attempt to get the default value.
  if (!firstArg && aggregate?.parameters?.[0]) {
    if (aggregate.parameters[0].required === false) {
      firstArg = aggregate.parameters[0].defaultValue;
    }
  }

  if (firstArg && SESSIONS_FIELDS.hasOwnProperty(firstArg)) {
    return SESSIONS_FIELDS[firstArg].type as AggregationOutputType;
  }

  // If the function is an inherit type it will have a field as
  // the first parameter and we can use that to get the type.
  const fieldDef = getFieldDefinition(firstArg ?? '');

  if (fieldDef !== null) {
    return fieldDef.valueType as AggregationOutputType;
  }

  if (firstArg && isMeasurement(firstArg)) {
    return measurementType(firstArg);
  }

  if (firstArg && isSpanOperationBreakdownField(firstArg)) {
    return 'duration';
  }

  return null;
}

export function errorsAndTransactionsAggregateFunctionOutputType(
  funcName: string,
  firstArg: string | undefined
): AggregationOutputType | null {
  const aggregate = AGGREGATIONS[ALIASES[funcName] || funcName];

  // Attempt to use the function's outputType.
  if (aggregate?.outputType) {
    return aggregate.outputType;
  }

  // If the first argument is undefined and it is not required,
  // then we attempt to get the default value.
  if (!firstArg && aggregate?.parameters?.[0]) {
    if (aggregate.parameters[0].required === false) {
      firstArg = aggregate.parameters[0].defaultValue;
    }
  }

  // If the function is an inherit type it will have a field as
  // the first parameter and we can use that to get the type.
  const fieldDef = getFieldDefinition(firstArg ?? '');

  if (fieldDef !== null) {
    return fieldDef.valueType as AggregationOutputType;
  }

  if (firstArg && isMeasurement(firstArg)) {
    return measurementType(firstArg);
  }

  if (firstArg && isSpanOperationBreakdownField(firstArg)) {
    return 'duration';
  }

  return null;
}

export function sessionsAggregateFunctionOutputType(
  funcName: string,
  firstArg: string | undefined
): AggregationOutputType | null {
  const aggregate = SESSIONS_OPERATIONS[funcName];

  // Attempt to use the function's outputType.
  if (aggregate?.outputType) {
    return aggregate.outputType;
  }

  // If the first argument is undefined and it is not required,
  // then we attempt to get the default value.
  if (!firstArg && aggregate?.parameters?.[0]) {
    if (aggregate.parameters[0].required === false) {
      firstArg = aggregate.parameters[0].defaultValue;
    }
  }

  if (firstArg && SESSIONS_FIELDS.hasOwnProperty(firstArg)) {
    return SESSIONS_FIELDS[firstArg].type as AggregationOutputType;
  }

  return null;
}

/**
 * Get the multi-series chart type for an aggregate function.
 */
export function aggregateMultiPlotType(field: string): PlotType {
  if (isEquation(field)) {
    return 'line';
  }
  const result = parseFunction(field);
  // Handle invalid data.
  if (!result) {
    return 'area';
  }
  if (!AGGREGATIONS.hasOwnProperty(result.name)) {
    return 'area';
  }
  return AGGREGATIONS[result.name].multiPlotType;
}

function validateForNumericAggregate(
  validColumnTypes: ColumnType[]
): ValidateColumnValueFunction {
  return function ({name, dataType}: {dataType: ColumnType; name: string}): boolean {
    // these built-in columns cannot be applied to numeric aggregates such as percentile(...)
    if (
      [
        FieldKey.DEVICE_BATTERY_LEVEL,
        FieldKey.STACK_COLNO,
        FieldKey.STACK_LINENO,
        FieldKey.STACK_STACK_LEVEL,
      ].includes(name as FieldKey)
    ) {
      return false;
    }

    return validColumnTypes.includes(dataType);
  };
}

function validateDenyListColumns(
  validColumnTypes: ColumnType[],
  deniedColumns: string[]
): ValidateColumnValueFunction {
  return function ({name, dataType}: {dataType: ColumnType; name: string}): boolean {
    return validColumnTypes.includes(dataType) && !deniedColumns.includes(name);
  };
}

function validateAllowedColumns(validColumns: string[]): ValidateColumnValueFunction {
  return function ({name}): boolean {
    return validColumns.includes(name);
  };
}

const alignedTypes: ColumnValueType[] = ['number', 'duration', 'integer', 'percentage'];

export function fieldAlignment(
  columnName: string,
  columnType?: undefined | ColumnValueType,
  metadata?: Record<string, ColumnValueType>
): Alignments {
  let align: Alignments = 'left';
  if (columnType) {
    align = alignedTypes.includes(columnType) ? 'right' : 'left';
  }
  if (columnType === undefined || columnType === 'never') {
    // fallback to align the column based on the table metadata
    const maybeType = metadata ? metadata[getAggregateAlias(columnName)] : undefined;

    if (maybeType !== undefined && alignedTypes.includes(maybeType)) {
      align = 'right';
    }
  }
  return align;
}

/**
 * Match on types that are legal to show on a timeseries chart.
 */
export function isLegalYAxisType(match: ColumnType | MetricsType) {
  return ['number', 'integer', 'duration', 'percentage'].includes(match);
}

export function getSpanOperationName(field: string): string | null {
  const results = field.match(SPAN_OP_BREAKDOWN_PATTERN);
  if (results && results.length >= 2) {
    return results[1];
  }
  return null;
}

export function getColumnType(column: Column): ColumnType {
  if (column.kind === 'function') {
    const outputType = aggregateFunctionOutputType(
      column.function[0],
      column.function[1]
    );
    if (outputType !== null) {
      return outputType;
    }
  } else if (column.kind === 'field') {
    const fieldDef = getFieldDefinition(column.field);

    if (fieldDef !== null) {
      return fieldDef.valueType as ColumnType;
    }
    if (isMeasurement(column.field)) {
      return measurementType(column.field);
    }
    if (isSpanOperationBreakdownField(column.field)) {
      return 'duration';
    }
  }
  return 'string';
}

export function hasDuplicate(columnList: Column[], column: Column): boolean {
  if (column.kind !== 'function' && column.kind !== 'field') {
    return false;
  }
  return columnList.filter(newColumn => isEqual(newColumn, column)).length > 1;
}
