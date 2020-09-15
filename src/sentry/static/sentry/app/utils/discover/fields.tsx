import {LightWeightOrganization} from 'app/types';
import {assert} from 'app/types/utils';

export type Sort = {
  kind: 'asc' | 'desc';
  field: string;
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

export type AggregateParameter =
  | {
      kind: 'column';
      columnTypes: Readonly<ColumnType[]>;
      defaultValue?: string;
      required: boolean;
    }
  | {
      kind: 'value';
      dataType: ColumnType;
      defaultValue?: string;
      required: boolean;
    };

export type AggregationRefinement = string | undefined;

// The parsed result of a Field.
// Functions and Fields are handled as subtypes to enable other
// code to work more simply.
// This type can be converted into a Field.field using generateFieldAsString()
export type QueryFieldValue =
  | {
      kind: 'field';
      field: string;
    }
  | {
      kind: 'function';
      function: [AggregationKey, string, AggregationRefinement];
    };

// Column is just an alias of a Query value
export type Column = QueryFieldValue;

// Refer to src/sentry/api/event_search.py
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
        required: true,
      },
    ],
    outputType: 'number',
    isSortable: true,
    multiPlotType: 'line',
  },
  min: {
    parameters: [
      {
        kind: 'column',
        columnTypes: ['integer', 'number', 'duration', 'date'],
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
        columnTypes: ['integer', 'number', 'duration', 'date'],
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
        columnTypes: ['duration'],
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
        columnTypes: ['duration'],
        required: true,
      },
    ],
    outputType: null,
    isSortable: true,
    multiPlotType: 'area',
  },
  last_seen: {
    parameters: [],
    outputType: 'date',
    isSortable: true,
    multiPlotType: 'area',
  },

  // Tracing functions.
  p50: {
    parameters: [],
    outputType: 'duration',
    isSortable: true,
    multiPlotType: 'line',
  },
  p75: {
    parameters: [],
    outputType: 'duration',
    isSortable: true,
    multiPlotType: 'line',
  },
  p95: {
    parameters: [],
    outputType: 'duration',
    type: [],
    isSortable: true,
    multiPlotType: 'line',
  },
  p99: {
    parameters: [],
    outputType: 'duration',
    isSortable: true,
    multiPlotType: 'line',
  },
  p100: {
    parameters: [],
    outputType: 'duration',
    isSortable: true,
    multiPlotType: 'line',
  },
  percentile: {
    parameters: [
      {
        kind: 'column',
        columnTypes: ['duration'],
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
  failure_rate: {
    parameters: [],
    outputType: 'percentage',
    isSortable: true,
    multiPlotType: 'line',
  },
  apdex: {
    generateDefaultValue({parameter, organization}: DefaultValueInputs) {
      return organization.apdexThreshold?.toString() ?? parameter.defaultValue;
    },
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
    generateDefaultValue({parameter, organization}: DefaultValueInputs) {
      return organization.apdexThreshold?.toString() ?? parameter.defaultValue;
    },
    parameters: [
      {
        kind: 'value',
        dataType: 'number',
        defaultValue: '300',
        required: true,
      },
    ],
    outputType: 'number',
    isSortable: false,
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
} as const;

assert(AGGREGATIONS as Readonly<{[key in keyof typeof AGGREGATIONS]: Aggregation}>);

export type AggregationKey = keyof typeof AGGREGATIONS | '';

export type AggregationOutputType = Extract<
  ColumnType,
  'number' | 'integer' | 'date' | 'duration' | 'percentage'
>;

export type PlotType = 'line' | 'area';

type DefaultValueInputs = {
  parameter: AggregateParameter;
  organization: LightWeightOrganization;
};

export type Aggregation = {
  /**
   * Used by functions that need to define their default values dynamically
   * based on the organization, or parameter data.
   */
  generateDefaultValue?: (data: DefaultValueInputs) => string;
  /**
   * List of parameters for the function.
   */
  parameters: Readonly<AggregateParameter[]>;
  /**
   * The output type. Null means to inherit from the field.
   */
  outputType: AggregationOutputType | null;
  /**
   * Can this function be used in a sort result
   */
  isSortable: boolean;
  /**
   * How this function should be plotted when shown in a multiseries result (top5)
   */
  multiPlotType: PlotType;
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
  TIME = 'time',
  TIMESTAMP = 'timestamp',
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
  [FieldKey.TIME]: 'date',

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

export type FieldTag = {
  key: FieldKey;
  name: FieldKey;
};

export const FIELD_TAGS = Object.freeze(
  Object.fromEntries(Object.keys(FIELDS).map(item => [item, {key: item, name: item}]))
);

// Allows for a less strict field key definition in cases we are returning custom strings as fields
export type LooseFieldKey = FieldKey | string | '';

// This list should be removed with the tranaction-events feature flag.
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
  'user_misery',
  'eps',
  'epm',
];

const AGGREGATE_PATTERN = /^([^\(]+)\((.*?)(?:\s*,\s*(.*))?\)$/;

export function explodeFieldString(field: string): Column {
  const results = field.match(AGGREGATE_PATTERN);

  if (results && results.length >= 3) {
    return {
      kind: 'function',
      function: [
        results[1] as AggregationKey,
        results[2],
        results[3] as AggregationRefinement,
      ],
    };
  }

  return {kind: 'field', field};
}

export function generateFieldAsString(value: QueryFieldValue): string {
  if (value.kind === 'field') {
    return value.field;
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
  if (!field.match(AGGREGATE_PATTERN)) {
    return field;
  }
  return field
    .replace(AGGREGATE_PATTERN, '$1_$2_$3')
    .replace(/\./g, '_')
    .replace(/\,/g, '_')
    .replace(/_+$/, '');
}

/**
 * Check if a field name looks like an aggregate function or known aggregate alias.
 */
export function isAggregateField(field: string): boolean {
  return field.match(AGGREGATE_PATTERN) !== null;
}

/**
 * Convert a function string into type it will output.
 * This is useful when you need to format values in tooltips,
 * or in series markers.
 */
export function aggregateOutputType(field: string): AggregationOutputType {
  const matches = AGGREGATE_PATTERN.exec(field);
  if (!matches) {
    return 'number';
  }
  const funcName = matches[1];
  const aggregate = AGGREGATIONS[funcName];
  // Attempt to use the function's outputType. If the function
  // is an inherit type it will have a field as the first parameter
  // and we can use that to get the type.
  if (aggregate && aggregate.outputType) {
    return aggregate.outputType;
  } else if (matches[2] && FIELDS.hasOwnProperty(matches[2])) {
    return FIELDS[matches[2]];
  }
  return 'number';
}

/**
 * Get the multi-series chart type for an aggregate function.
 */
export function aggregateMultiPlotType(field: string): PlotType {
  const matches = AGGREGATE_PATTERN.exec(field);
  // Handle invalid data.
  if (!matches) {
    return 'area';
  }
  const funcName = matches[1];
  if (!AGGREGATIONS.hasOwnProperty(funcName)) {
    return 'area';
  }
  return AGGREGATIONS[funcName].multiPlotType;
}
