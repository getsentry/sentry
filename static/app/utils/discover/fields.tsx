import isEqual from 'lodash/isEqual';

import {RELEASE_ADOPTION_STAGES} from 'sentry/constants';
import {MetricsColumnType, Organization, SelectValue} from 'sentry/types';
import {assert} from 'sentry/types/utils';

import {METRIC_TO_COLUMN_TYPE} from '../metrics/fields';

export type Sort = {
  field: string;
  kind: 'asc' | 'desc';
};

// Contains the URL field value & the related table column width.
// Can be parsed into a Column using explodeField()
export type Field = {
  field: string;
  width?: number;
};

export type ColumnType =
  | 'boolean'
  | 'date'
  | 'duration'
  | 'integer'
  | 'number'
  | 'percentage'
  | 'string';

export type ColumnValueType = ColumnType | 'never'; // Matches to nothing

export type ParsedFunction = {
  arguments: string[];
  name: string;
};

type ValidateColumnValueFunction = ({name: string, dataType: ColumnType}) => boolean;

export type ValidateColumnTypes =
  | ColumnType[]
  | MetricsColumnType[]
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
export type QueryFieldValue =
  | {
      field: string;
      kind: 'field';
    }
  | {
      field: string;
      kind: 'equation';
    }
  | {
      function: [AggregationKey, string, AggregationRefinement, AggregationRefinement];
      kind: 'function';
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

// Refer to src/sentry/search/events/fields.py
// Try to keep functions logically sorted, ie. all the count functions are grouped together
export const AGGREGATIONS = {
  count: {
    parameters: [],
    outputType: 'number',
    isSortable: true,
    multiPlotType: 'area',
  },
  count_unique: {
    parameters: [
      {
        kind: 'column',
        columnTypes: ['string', 'integer', 'number', 'duration', 'date', 'boolean'],
        defaultValue: 'user',
        required: true,
      },
    ],
    outputType: 'number',
    isSortable: true,
    multiPlotType: 'line',
  },
  count_miserable: {
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
    outputType: 'number',
    isSortable: true,
    multiPlotType: 'area',
  },
  count_if: {
    parameters: [
      {
        kind: 'column',
        columnTypes: validateDenyListColumns(
          ['string', 'duration'],
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
    outputType: 'number',
    isSortable: true,
    multiPlotType: 'area',
  },
  eps: {
    parameters: [],
    outputType: 'number',
    isSortable: true,
    multiPlotType: 'area',
  },
  epm: {
    parameters: [],
    outputType: 'number',
    isSortable: true,
    multiPlotType: 'area',
  },
  failure_count: {
    parameters: [],
    outputType: 'number',
    isSortable: true,
    multiPlotType: 'line',
  },
  min: {
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
    outputType: null,
    isSortable: true,
    multiPlotType: 'line',
  },
  max: {
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
    outputType: null,
    isSortable: true,
    multiPlotType: 'line',
  },
  sum: {
    parameters: [
      {
        kind: 'column',
        columnTypes: validateForNumericAggregate(['duration', 'number', 'percentage']),
        required: true,
        defaultValue: 'transaction.duration',
      },
    ],
    outputType: null,
    isSortable: true,
    multiPlotType: 'area',
  },
  any: {
    parameters: [
      {
        kind: 'column',
        columnTypes: ['string', 'integer', 'number', 'duration', 'date', 'boolean'],
        required: true,
        defaultValue: 'transaction.duration',
      },
    ],
    outputType: null,
    isSortable: true,
  },
  p50: {
    parameters: [
      {
        kind: 'column',
        columnTypes: validateForNumericAggregate(['duration', 'number', 'percentage']),
        defaultValue: 'transaction.duration',
        required: false,
      },
    ],
    outputType: null,
    isSortable: true,
    multiPlotType: 'line',
  },
  p75: {
    parameters: [
      {
        kind: 'column',
        columnTypes: validateForNumericAggregate(['duration', 'number', 'percentage']),
        defaultValue: 'transaction.duration',
        required: false,
      },
    ],
    outputType: null,
    isSortable: true,
    multiPlotType: 'line',
  },
  p95: {
    parameters: [
      {
        kind: 'column',
        columnTypes: validateForNumericAggregate(['duration', 'number', 'percentage']),
        defaultValue: 'transaction.duration',
        required: false,
      },
    ],
    outputType: null,
    type: [],
    isSortable: true,
    multiPlotType: 'line',
  },
  p99: {
    parameters: [
      {
        kind: 'column',
        columnTypes: validateForNumericAggregate(['duration', 'number', 'percentage']),
        defaultValue: 'transaction.duration',
        required: false,
      },
    ],
    outputType: null,
    isSortable: true,
    multiPlotType: 'line',
  },
  p100: {
    parameters: [
      {
        kind: 'column',
        columnTypes: validateForNumericAggregate(['duration', 'number', 'percentage']),
        defaultValue: 'transaction.duration',
        required: false,
      },
    ],
    outputType: null,
    isSortable: true,
    multiPlotType: 'line',
  },
  percentile: {
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
    outputType: null,
    isSortable: true,
    multiPlotType: 'line',
  },
  avg: {
    parameters: [
      {
        kind: 'column',
        columnTypes: validateForNumericAggregate(['duration', 'number', 'percentage']),
        defaultValue: 'transaction.duration',
        required: true,
      },
    ],
    outputType: null,
    isSortable: true,
    multiPlotType: 'line',
  },
  apdex: {
    parameters: [
      {
        kind: 'value',
        dataType: 'number',
        defaultValue: '300',
        required: true,
      },
    ],
    outputType: 'number',
    isSortable: true,
    multiPlotType: 'line',
  },
  user_misery: {
    parameters: [
      {
        kind: 'value',
        dataType: 'number',
        defaultValue: '300',
        required: true,
      },
    ],
    outputType: 'number',
    isSortable: true,
    multiPlotType: 'line',
  },
  failure_rate: {
    parameters: [],
    outputType: 'percentage',
    isSortable: true,
    multiPlotType: 'line',
  },
  last_seen: {
    parameters: [],
    outputType: 'date',
    isSortable: true,
  },
} as const;

// TPM and TPS are aliases that are only used in Performance
export const ALIASES = {
  tpm: 'epm',
  tps: 'eps',
};

assert(AGGREGATIONS as Readonly<{[key in keyof typeof AGGREGATIONS]: Aggregation}>);

export type AggregationKey = keyof typeof AGGREGATIONS | keyof typeof ALIASES | '';

export type AggregationOutputType = Extract<
  ColumnType,
  'number' | 'integer' | 'date' | 'duration' | 'percentage' | 'string'
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

enum FieldKey {
  CULPRIT = 'culprit',
  DEVICE_ARCH = 'device.arch',
  DEVICE_BATTERY_LEVEL = 'device.battery_level',
  DEVICE_BRAND = 'device.brand',
  DEVICE_CHARGING = 'device.charging',
  DEVICE_LOCALE = 'device.locale',
  DEVICE_NAME = 'device.name',
  DEVICE_ONLINE = 'device.online',
  DEVICE_ORIENTATION = 'device.orientation',
  DEVICE_SIMULATOR = 'device.simulator',
  DEVICE_UUID = 'device.uuid',
  DIST = 'dist',
  ENVIRONMENT = 'environment',
  ERROR_HANDLED = 'error.handled',
  ERROR_UNHANDLED = 'error.unhandled',
  ERROR_MECHANISM = 'error.mechanism',
  ERROR_TYPE = 'error.type',
  ERROR_VALUE = 'error.value',
  EVENT_TYPE = 'event.type',
  GEO_CITY = 'geo.city',
  GEO_COUNTRY_CODE = 'geo.country_code',
  GEO_REGION = 'geo.region',
  HTTP_METHOD = 'http.method',
  HTTP_REFERER = 'http.referer',
  HTTP_URL = 'http.url',
  ID = 'id',
  ISSUE = 'issue',
  LOCATION = 'location',
  MESSAGE = 'message',
  OS_BUILD = 'os.build',
  OS_KERNEL_VERSION = 'os.kernel_version',
  PLATFORM_NAME = 'platform.name',
  PROJECT = 'project',
  RELEASE = 'release',
  SDK_NAME = 'sdk.name',
  SDK_VERSION = 'sdk.version',
  STACK_ABS_PATH = 'stack.abs_path',
  STACK_COLNO = 'stack.colno',
  STACK_FILENAME = 'stack.filename',
  STACK_FUNCTION = 'stack.function',
  STACK_IN_APP = 'stack.in_app',
  STACK_LINENO = 'stack.lineno',
  STACK_MODULE = 'stack.module',
  STACK_PACKAGE = 'stack.package',
  STACK_STACK_LEVEL = 'stack.stack_level',
  TIMESTAMP = 'timestamp',
  TIMESTAMP_TO_HOUR = 'timestamp.to_hour',
  TIMESTAMP_TO_DAY = 'timestamp.to_day',
  TITLE = 'title',
  TRACE = 'trace',
  TRACE_PARENT_SPAN = 'trace.parent_span',
  TRACE_SPAN = 'trace.span',
  TRANSACTION = 'transaction',
  TRANSACTION_DURATION = 'transaction.duration',
  TRANSACTION_OP = 'transaction.op',
  TRANSACTION_STATUS = 'transaction.status',
  USER_EMAIL = 'user.email',
  USER_ID = 'user.id',
  USER_IP = 'user.ip',
  USER_USERNAME = 'user.username',
  USER_DISPLAY = 'user.display',
}

/**
 * Refer to src/sentry/snuba/events.py, search for Columns
 */
export const FIELDS: Readonly<Record<FieldKey, ColumnType>> = {
  [FieldKey.ID]: 'string',
  // issue.id and project.id are omitted on purpose.
  // Customers should use `issue` and `project` instead.
  [FieldKey.TIMESTAMP]: 'date',
  // time is omitted on purpose.
  // Customers should use `timestamp` or `timestamp.to_hour`.
  [FieldKey.TIMESTAMP_TO_HOUR]: 'date',
  [FieldKey.TIMESTAMP_TO_DAY]: 'date',

  [FieldKey.CULPRIT]: 'string',
  [FieldKey.LOCATION]: 'string',
  [FieldKey.MESSAGE]: 'string',
  [FieldKey.PLATFORM_NAME]: 'string',
  [FieldKey.ENVIRONMENT]: 'string',
  [FieldKey.RELEASE]: 'string',
  [FieldKey.DIST]: 'string',
  [FieldKey.TITLE]: 'string',
  [FieldKey.EVENT_TYPE]: 'string',
  // tags.key and tags.value are omitted on purpose as well.

  [FieldKey.TRANSACTION]: 'string',
  [FieldKey.USER_ID]: 'string',
  [FieldKey.USER_EMAIL]: 'string',
  [FieldKey.USER_USERNAME]: 'string',
  [FieldKey.USER_IP]: 'string',
  [FieldKey.SDK_NAME]: 'string',
  [FieldKey.SDK_VERSION]: 'string',
  [FieldKey.HTTP_METHOD]: 'string',
  [FieldKey.HTTP_REFERER]: 'string',
  [FieldKey.HTTP_URL]: 'string',
  [FieldKey.OS_BUILD]: 'string',
  [FieldKey.OS_KERNEL_VERSION]: 'string',
  [FieldKey.DEVICE_NAME]: 'string',
  [FieldKey.DEVICE_BRAND]: 'string',
  [FieldKey.DEVICE_LOCALE]: 'string',
  [FieldKey.DEVICE_UUID]: 'string',
  [FieldKey.DEVICE_ARCH]: 'string',
  [FieldKey.DEVICE_BATTERY_LEVEL]: 'number',
  [FieldKey.DEVICE_ORIENTATION]: 'string',
  [FieldKey.DEVICE_SIMULATOR]: 'boolean',
  [FieldKey.DEVICE_ONLINE]: 'boolean',
  [FieldKey.DEVICE_CHARGING]: 'boolean',
  [FieldKey.GEO_COUNTRY_CODE]: 'string',
  [FieldKey.GEO_REGION]: 'string',
  [FieldKey.GEO_CITY]: 'string',
  [FieldKey.ERROR_TYPE]: 'string',
  [FieldKey.ERROR_VALUE]: 'string',
  [FieldKey.ERROR_MECHANISM]: 'string',
  [FieldKey.ERROR_HANDLED]: 'boolean',
  [FieldKey.ERROR_UNHANDLED]: 'boolean',
  [FieldKey.STACK_ABS_PATH]: 'string',
  [FieldKey.STACK_FILENAME]: 'string',
  [FieldKey.STACK_PACKAGE]: 'string',
  [FieldKey.STACK_MODULE]: 'string',
  [FieldKey.STACK_FUNCTION]: 'string',
  [FieldKey.STACK_IN_APP]: 'boolean',
  [FieldKey.STACK_COLNO]: 'number',
  [FieldKey.STACK_LINENO]: 'number',
  [FieldKey.STACK_STACK_LEVEL]: 'number',
  // contexts.key and contexts.value omitted on purpose.

  // Transaction event fields.
  [FieldKey.TRANSACTION_DURATION]: 'duration',
  [FieldKey.TRANSACTION_OP]: 'string',
  [FieldKey.TRANSACTION_STATUS]: 'string',

  [FieldKey.TRACE]: 'string',
  [FieldKey.TRACE_SPAN]: 'string',
  [FieldKey.TRACE_PARENT_SPAN]: 'string',

  // Field alises defined in src/sentry/api/event_search.py
  [FieldKey.PROJECT]: 'string',
  [FieldKey.ISSUE]: 'string',
  [FieldKey.USER_DISPLAY]: 'string',
};

export const DEPRECATED_FIELDS: string[] = [FieldKey.CULPRIT];

export type FieldTag = {
  key: FieldKey;
  name: FieldKey;
};

export const FIELD_TAGS = Object.freeze(
  Object.fromEntries(Object.keys(FIELDS).map(item => [item, {key: item, name: item}]))
);

export const SEMVER_TAGS = {
  'release.version': {
    key: 'release.version',
    name: 'release.version',
  },
  'release.build': {
    key: 'release.build',
    name: 'release.build',
  },
  'release.package': {
    key: 'release.package',
    name: 'release.package',
  },
  'release.stage': {
    key: 'release.stage',
    name: 'release.stage',
    predefined: true,
    values: RELEASE_ADOPTION_STAGES,
  },
};

/**
 * Some tag keys should never be formatted as `tag[...]`
 * when used as a filter because they are predefined.
 */
const EXCLUDED_TAG_KEYS = new Set(['release']);

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

export enum WebVital {
  FP = 'measurements.fp',
  FCP = 'measurements.fcp',
  LCP = 'measurements.lcp',
  FID = 'measurements.fid',
  CLS = 'measurements.cls',
  TTFB = 'measurements.ttfb',
  RequestTime = 'measurements.ttfb.requesttime',
}

export enum MobileVital {
  AppStartCold = 'measurements.app_start_cold',
  AppStartWarm = 'measurements.app_start_warm',
  FramesTotal = 'measurements.frames_total',
  FramesSlow = 'measurements.frames_slow',
  FramesFrozen = 'measurements.frames_frozen',
  FramesSlowRate = 'measurements.frames_slow_rate',
  FramesFrozenRate = 'measurements.frames_frozen_rate',
  StallCount = 'measurements.stall_count',
  StallTotalTime = 'measurements.stall_total_time',
  StallLongestTime = 'measurements.stall_longest_time',
  StallPercentage = 'measurements.stall_percentage',
}

const MEASUREMENTS: Readonly<Record<WebVital | MobileVital, ColumnType>> = {
  [WebVital.FP]: 'duration',
  [WebVital.FCP]: 'duration',
  [WebVital.LCP]: 'duration',
  [WebVital.FID]: 'duration',
  [WebVital.CLS]: 'number',
  [WebVital.TTFB]: 'duration',
  [WebVital.RequestTime]: 'duration',
  [MobileVital.AppStartCold]: 'duration',
  [MobileVital.AppStartWarm]: 'duration',
  [MobileVital.FramesTotal]: 'integer',
  [MobileVital.FramesSlow]: 'integer',
  [MobileVital.FramesFrozen]: 'integer',
  [MobileVital.FramesSlowRate]: 'percentage',
  [MobileVital.FramesFrozenRate]: 'percentage',
  [MobileVital.StallCount]: 'integer',
  [MobileVital.StallTotalTime]: 'duration',
  [MobileVital.StallLongestTime]: 'duration',
  [MobileVital.StallPercentage]: 'percentage',
};

export function isSpanOperationBreakdownField(field: string) {
  return field.startsWith('spans.');
}

export const SPAN_OP_RELATIVE_BREAKDOWN_FIELD = 'span_ops_breakdown.relative';

export function isRelativeSpanOperationBreakdownField(field: string) {
  return field === SPAN_OP_RELATIVE_BREAKDOWN_FIELD;
}

export const SPAN_OP_BREAKDOWN_FIELDS = [
  'spans.http',
  'spans.db',
  'spans.browser',
  'spans.resource',
];

// This list contains fields/functions that are available with performance-view feature.
export const TRACING_FIELDS = [
  'avg',
  'sum',
  'transaction.duration',
  'transaction.op',
  'transaction.status',
  'p50',
  'p75',
  'p95',
  'p99',
  'p100',
  'percentile',
  'failure_rate',
  'apdex',
  'count_miserable',
  'user_misery',
  'eps',
  'epm',
  'team_key_transaction',
  ...Object.keys(MEASUREMENTS),
  ...SPAN_OP_BREAKDOWN_FIELDS,
  SPAN_OP_RELATIVE_BREAKDOWN_FIELD,
];

export const MEASUREMENT_PATTERN = /^measurements\.([a-zA-Z0-9-_.]+)$/;
export const SPAN_OP_BREAKDOWN_PATTERN = /^spans\.([a-zA-Z0-9-_.]+)$/;

export function isMeasurement(field: string): boolean {
  const results = field.match(MEASUREMENT_PATTERN);
  return !!results;
}

export function measurementType(field: string) {
  if (MEASUREMENTS.hasOwnProperty(field)) {
    return MEASUREMENTS[field];
  }
  return 'number';
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
    (functionText !== 'to_other' && functionText !== 'count_if') ||
    columnText.length === 0
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
const EQUATION_PREFIX = 'equation|';
const EQUATION_ALIAS_PATTERN = /^equation\[(\d+)\]$/;

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

export function explodeFieldString(field: string): Column {
  if (isEquation(field)) {
    return {kind: 'equation', field: getEquation(field)};
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
    };
  }

  return {kind: 'field', field};
}

export function generateFieldAsString(value: QueryFieldValue): string {
  if (value.kind === 'field') {
    return value.field;
  }
  if (value.kind === 'equation') {
    return `${EQUATION_PREFIX}${value.field}`;
  }

  const aggregation = value.function[0];
  const parameters = value.function.slice(1).filter(i => i);
  return `${aggregation}(${parameters.join(',')})`;
}

export function explodeField(field: Field): Column {
  const results = explodeFieldString(field.field);

  return results;
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
  return isAggregateField(field) || isAggregateEquation(field);
}

export function getAggregateFields(fields: string[]): string[] {
  return fields.filter(field => isAggregateField(field) || isAggregateEquation(field));
}

/**
 * Convert a function string into type it will output.
 * This is useful when you need to format values in tooltips,
 * or in series markers.
 */
export function aggregateOutputType(field: string): AggregationOutputType {
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

  if (firstArg && METRIC_TO_COLUMN_TYPE.hasOwnProperty(firstArg)) {
    return METRIC_TO_COLUMN_TYPE[firstArg];
  }

  // If the function is an inherit type it will have a field as
  // the first parameter and we can use that to get the type.
  if (firstArg && FIELDS.hasOwnProperty(firstArg)) {
    return FIELDS[firstArg];
  }

  if (firstArg && isMeasurement(firstArg)) {
    return measurementType(firstArg);
  }

  if (firstArg && isSpanOperationBreakdownField(firstArg)) {
    return 'duration';
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
export function isLegalYAxisType(match: ColumnType) {
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
    if (FIELDS.hasOwnProperty(column.field)) {
      return FIELDS[column.field];
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
