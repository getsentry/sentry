import isEqual from 'lodash/isEqual';

import type {FilterKeySection} from 'sentry/components/searchQueryBuilder/types';
import {RELEASE_ADOPTION_STAGES} from 'sentry/constants';
import type {SelectValue} from 'sentry/types/core';
import type {MetricType} from 'sentry/types/metrics';
import type {Organization} from 'sentry/types/organization';
import {assert} from 'sentry/types/utils';
import {isMRIField} from 'sentry/utils/metrics/mri';
import {
  SESSIONS_FIELDS,
  SESSIONS_OPERATIONS,
} from 'sentry/views/dashboards/widgetBuilder/releaseWidget/fields';
import {STARFISH_FIELDS} from 'sentry/views/insights/common/utils/constants';
import {STARFISH_AGGREGATION_FIELDS} from 'sentry/views/insights/constants';

import {
  AGGREGATION_FIELDS,
  AggregationKey,
  DISCOVER_FIELDS,
  FieldKey,
  FieldKind,
  FieldValueType,
  getFieldDefinition,
  MEASUREMENT_FIELDS,
  MobileVital,
  SpanOpBreakdown,
  WebVital,
} from '../fields';

import {CONDITIONS_ARGUMENTS, DiscoverDatasets, WEB_VITALS_QUALITY} from './types';

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
  | MetricType[]
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
        AggregationRefinement,
      ];
      kind: 'function';
      alias?: string;
    };

// Column is just an alias of a Query value
export type Column = QueryFieldValue;

export type Alignments = 'left' | 'right';

export type CountUnit = 'count';

export type PercentageUnit = 'percentage';

export type PercentChangeUnit = 'percent_change';

export enum CurrencyUnit {
  USD = 'usd',
}

export enum DurationUnit {
  NANOSECOND = 'nanosecond',
  MICROSECOND = 'microsecond',
  MILLISECOND = 'millisecond',
  SECOND = 'second',
  MINUTE = 'minute',
  HOUR = 'hour',
  DAY = 'day',
  WEEK = 'week',
  MONTH = 'month',
  YEAR = 'year',
}

// Durations normalized to millisecond unit
export const DURATION_UNIT_MULTIPLIERS: Record<DurationUnit, number> = {
  nanosecond: 1 / 1000 ** 2,
  microsecond: 1 / 1000,
  millisecond: 1,
  second: 1000,
  minute: 1000 * 60,
  hour: 1000 * 60 * 60,
  day: 1000 * 60 * 60 * 24,
  week: 1000 * 60 * 60 * 24 * 7,
  month: 1000 * 60 * 60 * 24 * 30,
  year: 1000 * 60 * 60 * 24 * 365,
};

export const DURATION_UNIT_LABELS: Record<DurationUnit, string> = {
  nanosecond: 'ns',
  microsecond: 'μs',
  millisecond: 'ms',
  second: 's',
  minute: 'min',
  hour: 'hr',
  day: 'd',
  week: 'wk',
  month: 'mo',
  year: 'yr',
};

export enum SizeUnit {
  BIT = 'bit',
  BYTE = 'byte',
  KIBIBYTE = 'kibibyte',
  KILOBYTE = 'kilobyte',
  MEBIBYTE = 'mebibyte',
  MEGABYTE = 'megabyte',
  GIBIBYTE = 'gibibyte',
  GIGABYTE = 'gigabyte',
  TEBIBYTE = 'tebibyte',
  TERABYTE = 'terabyte',
  PEBIBYTE = 'pebibyte',
  PETABYTE = 'petabyte',
  EXBIBYTE = 'exbibyte',
  EXABYTE = 'exabyte',
}

// Sizes normalized to byte unit
export const SIZE_UNIT_MULTIPLIERS: Record<SizeUnit, number> = {
  bit: 1 / 8,
  byte: 1,
  kibibyte: 1024,
  mebibyte: 1024 ** 2,
  gibibyte: 1024 ** 3,
  tebibyte: 1024 ** 4,
  pebibyte: 1024 ** 5,
  exbibyte: 1024 ** 6,
  kilobyte: 1000,
  megabyte: 1000 ** 2,
  gigabyte: 1000 ** 3,
  terabyte: 1000 ** 4,
  petabyte: 1000 ** 5,
  exabyte: 1000 ** 6,
};

export const SIZE_UNIT_LABELS: Record<SizeUnit, string> = {
  bit: 'b',
  byte: 'B',
  kibibyte: 'KiB',
  kilobyte: 'KB',
  mebibyte: 'MiB',
  megabyte: 'MB',
  gibibyte: 'GiB',
  gigabyte: 'GB',
  tebibyte: 'TiB',
  terabyte: 'TB',
  pebibyte: 'PiB',
  petabyte: 'PB',
  exbibyte: 'EiB',
  exabyte: 'EB',
};

export enum RateUnit {
  PER_SECOND = '1/second',
  PER_MINUTE = '1/minute',
  PER_HOUR = '1/hour',
}

// Rates normalized to /second unit
export const RATE_UNIT_MULTIPLIERS: Record<RateUnit, number> = {
  [RateUnit.PER_SECOND]: 1,
  [RateUnit.PER_MINUTE]: 1 / 60,
  [RateUnit.PER_HOUR]: 1 / (60 * 60),
};

export const RATE_UNIT_LABELS: Record<RateUnit, string> = {
  [RateUnit.PER_SECOND]: '/s',
  [RateUnit.PER_MINUTE]: '/min',
  [RateUnit.PER_HOUR]: '/hr',
};

export const RATE_UNIT_TITLE: Record<RateUnit, string> = {
  [RateUnit.PER_SECOND]: 'Per Second',
  [RateUnit.PER_MINUTE]: 'Per Minute',
  [RateUnit.PER_HOUR]: 'Per Hour',
};

const getDocsAndOutputType = (key: AggregationKey) => {
  return {
    documentation: AGGREGATION_FIELDS[key].desc,
    outputType: AGGREGATION_FIELDS[key].valueType as AggregationOutputType,
  };
};

// Refer to src/sentry/search/events/fields.py
// Try to keep functions logically sorted, ie. all the count functions are grouped together
// When dealing with errors or transactions datasets, use getAggregations() instead because
// there are dataset-specific overrides
export const AGGREGATIONS = {
  [AggregationKey.COUNT]: {
    ...getDocsAndOutputType(AggregationKey.COUNT),
    parameters: [],
    isSortable: true,
    multiPlotType: 'area',
  },
  [AggregationKey.COUNT_UNIQUE]: {
    ...getDocsAndOutputType(AggregationKey.COUNT_UNIQUE),
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
  [AggregationKey.COUNT_MISERABLE]: {
    ...getDocsAndOutputType(AggregationKey.COUNT_MISERABLE),
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
  [AggregationKey.COUNT_IF]: {
    ...getDocsAndOutputType(AggregationKey.COUNT_IF),
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
        defaultValue: CONDITIONS_ARGUMENTS[0]!.value,
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
  [AggregationKey.COUNT_WEB_VITALS]: {
    ...getDocsAndOutputType(AggregationKey.COUNT_WEB_VITALS),
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
        defaultValue: WEB_VITALS_QUALITY[0]!.value,
        required: true,
      },
    ],
    isSortable: true,
    multiPlotType: 'area',
  },
  [AggregationKey.EPS]: {
    ...getDocsAndOutputType(AggregationKey.EPS),
    parameters: [],
    isSortable: true,
    multiPlotType: 'area',
  },
  [AggregationKey.EPM]: {
    ...getDocsAndOutputType(AggregationKey.EPM),
    parameters: [],
    isSortable: true,
    multiPlotType: 'area',
  },
  [AggregationKey.FAILURE_COUNT]: {
    ...getDocsAndOutputType(AggregationKey.FAILURE_COUNT),
    parameters: [],
    isSortable: true,
    multiPlotType: 'line',
  },
  [AggregationKey.MIN]: {
    ...getDocsAndOutputType(AggregationKey.MIN),
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
  [AggregationKey.MAX]: {
    ...getDocsAndOutputType(AggregationKey.MAX),
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
  [AggregationKey.SUM]: {
    ...getDocsAndOutputType(AggregationKey.SUM),
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
  [AggregationKey.ANY]: {
    ...getDocsAndOutputType(AggregationKey.ANY),
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
  [AggregationKey.P90]: {
    ...getDocsAndOutputType(AggregationKey.P90),
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
  [AggregationKey.PERCENTILE]: {
    ...getDocsAndOutputType(AggregationKey.PERCENTILE),
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
  [AggregationKey.AVG]: {
    ...getDocsAndOutputType(AggregationKey.AVG),
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
  [AggregationKey.APDEX]: {
    ...getDocsAndOutputType(AggregationKey.APDEX),
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
  [AggregationKey.USER_MISERY]: {
    ...getDocsAndOutputType(AggregationKey.USER_MISERY),
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
  [AggregationKey.FAILURE_RATE]: {
    ...getDocsAndOutputType(AggregationKey.FAILURE_RATE),
    parameters: [],
    isSortable: true,
    multiPlotType: 'line',
  },
  [AggregationKey.LAST_SEEN]: {
    ...getDocsAndOutputType(AggregationKey.LAST_SEEN),
    parameters: [],
    isSortable: true,
  },
  [AggregationKey.PERFORMANCE_SCORE]: {
    ...getDocsAndOutputType(AggregationKey.PERFORMANCE_SCORE),
    parameters: [
      {
        kind: 'dropdown',
        options: ['cls', 'fcp', 'inp', 'lcp', 'total', 'ttfb'].map(vital => ({
          label: `measurements.score.${vital}`,
          value: `measurements.score.${vital}`,
        })),
        dataType: 'number',
        defaultValue: 'measurements.score.total',
        required: true,
      },
    ],
    isSortable: true,
    multiPlotType: 'line',
  },
} as const;

// TPM and TPS are aliases that are only used in Performance
export const ALIASES = {
  tpm: AggregationKey.EPM,
  tps: AggregationKey.EPS,
};

assert(AGGREGATIONS as Readonly<{[key in AggregationKey]: Aggregation}>);

export type AggregationKeyWithAlias = `${AggregationKey}` | keyof typeof ALIASES | '';

export type AggregationOutputType = Extract<
  ColumnType,
  'number' | 'integer' | 'date' | 'duration' | 'percentage' | 'string' | 'size' | 'rate'
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
const EXCLUDED_TAG_KEYS = new Set(['release', 'user', 'device.class']);

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

// Returns the AGGREGATIONS object with the expected defaults for the given dataset
export function getAggregations(dataset: DiscoverDatasets) {
  if (dataset === DiscoverDatasets.DISCOVER) {
    return AGGREGATIONS;
  }

  return {
    ...AGGREGATIONS,
    [AggregationKey.COUNT_IF]: {
      ...AGGREGATIONS[AggregationKey.COUNT_IF],
      parameters: [
        {
          kind: 'column',
          columnTypes: validateDenyListColumns(
            ['string', 'duration', 'number'],
            ['id', 'issue', 'user.display']
          ),
          defaultValue:
            dataset === DiscoverDatasets.TRANSACTIONS
              ? 'transaction.duration'
              : 'event.type',
          required: true,
        },
        {
          kind: 'dropdown',
          options: CONDITIONS_ARGUMENTS,
          dataType: 'string',
          defaultValue: CONDITIONS_ARGUMENTS[0]!.value,
          required: true,
        },
        {
          kind: 'value',
          dataType: 'string',
          defaultValue: dataset === DiscoverDatasets.TRANSACTIONS ? '300' : 'error',
          required: true,
        },
      ],
    },
  } as const;
}

export const SPAN_OP_RELATIVE_BREAKDOWN_FIELD = 'span_ops_breakdown.relative';

export function isRelativeSpanOperationBreakdownField(field: string) {
  return field === SPAN_OP_RELATIVE_BREAKDOWN_FIELD;
}

export const SPAN_OP_BREAKDOWN_FIELDS = Object.values(SpanOpBreakdown);

// This list contains fields/functions that are available with performance-view feature.
export const TRACING_FIELDS = [
  AggregationKey.AVG,
  AggregationKey.SUM,
  FieldKey.TRANSACTION_DURATION,
  FieldKey.TRANSACTION_OP,
  FieldKey.TRANSACTION_STATUS,
  FieldKey.ISSUE,
  AggregationKey.P50,
  AggregationKey.P75,
  AggregationKey.P95,
  AggregationKey.P99,
  AggregationKey.P100,
  AggregationKey.PERCENTILE,
  AggregationKey.FAILURE_RATE,
  AggregationKey.APDEX,
  AggregationKey.COUNT_MISERABLE,
  AggregationKey.USER_MISERY,
  AggregationKey.EPS,
  AggregationKey.EPM,
  'team_key_transaction',
  ...Object.keys(MEASUREMENT_FIELDS),
  ...SPAN_OP_BREAKDOWN_FIELDS,
  SPAN_OP_RELATIVE_BREAKDOWN_FIELD,
];

export const TRANSACTION_ONLY_FIELDS: (FieldKey | SpanOpBreakdown)[] = [
  FieldKey.TRANSACTION_DURATION,
  FieldKey.TRANSACTION_OP,
  FieldKey.TRANSACTION_STATUS,
  FieldKey.PROFILE_ID,
  SpanOpBreakdown.SPANS_BROWSER,
  SpanOpBreakdown.SPANS_DB,
  SpanOpBreakdown.SPANS_HTTP,
  SpanOpBreakdown.SPANS_RESOURCE,
  SpanOpBreakdown.SPANS_UI,
];

export const ERROR_FIELDS = DISCOVER_FIELDS.filter(
  f => !TRANSACTION_ONLY_FIELDS.includes(f)
);

export const ERROR_ONLY_FIELDS: (FieldKey | SpanOpBreakdown)[] = [
  FieldKey.LOCATION,
  FieldKey.EVENT_TYPE,
  FieldKey.ERROR_TYPE,
  FieldKey.ERROR_VALUE,
  FieldKey.ERROR_MECHANISM,
  FieldKey.ERROR_HANDLED,
  FieldKey.ERROR_UNHANDLED,
  FieldKey.ERROR_RECEIVED,
  FieldKey.ERROR_MAIN_THREAD,
  FieldKey.LEVEL,
  FieldKey.STACK_ABS_PATH,
  FieldKey.STACK_FILENAME,
  FieldKey.STACK_PACKAGE,
  FieldKey.STACK_MODULE,
  FieldKey.STACK_FUNCTION,
  FieldKey.STACK_IN_APP,
  FieldKey.STACK_COLNO,
  FieldKey.STACK_LINENO,
  FieldKey.STACK_STACK_LEVEL,
  FieldKey.EVENT_TYPE,
];

export const TRANSACTION_FIELDS = DISCOVER_FIELDS.filter(
  f => !ERROR_ONLY_FIELDS.includes(f)
);

export const ERRORS_AGGREGATION_FUNCTIONS = [
  AggregationKey.COUNT,
  AggregationKey.COUNT_IF,
  AggregationKey.COUNT_UNIQUE,
  AggregationKey.EPS,
  AggregationKey.EPM,
  AggregationKey.LAST_SEEN,
];

// This list contains fields/functions that are available with profiling feature.
export const PROFILING_FIELDS: string[] = [FieldKey.PROFILE_ID];

export const MEASUREMENT_PATTERN = /^measurements\.([a-zA-Z0-9-_.]+)$/;
export const SPAN_OP_BREAKDOWN_PATTERN = /^spans\.([a-zA-Z0-9-_.]+)$/;

export function isMeasurement(field: string): boolean {
  return MEASUREMENT_PATTERN.test(field);
}

export function measurementType(field: string): MeasurementType {
  if (MEASUREMENT_FIELDS.hasOwnProperty(field)) {
    // @ts-ignore TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
    return MEASUREMENT_FIELDS[field].valueType as MeasurementType;
  }

  return FieldValueType.NUMBER;
}

export function getMeasurementSlug(field: string): string | null {
  const results = field.match(MEASUREMENT_PATTERN);
  if (results && results.length >= 2) {
    return results[1]!;
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
    return result.arguments[0]!;
  }

  return null;
}

export function parseFunction(field: string): ParsedFunction | null {
  const results = field.match(AGGREGATE_PATTERN);
  if (results && results.length === 3) {
    return {
      name: results[1]!,
      arguments: parseArguments(results[2]!),
    };
  }

  return null;
}

function _lookback(columnText: string, j: number, str: string) {
  // For parse_arguments, check that the current character is preceeded by string
  if (j < str.length) {
    return false;
  }
  return columnText.substring(j - str.length, j) === str;
}

export function parseArguments(columnText: string): string[] {
  const args: string[] = [];

  let quoted = false;
  let inTag = false;
  let escaped = false;

  let i: number = 0;
  let j: number = 0;

  while (j < columnText?.length) {
    if (!inTag && i === j && columnText[j] === '"') {
      // when we see a quote at the beginning of
      // an argument, then this is a quoted string
      quoted = true;
    } else if (!quoted && columnText[j] === '[' && _lookback(columnText, j, 'tags')) {
      // when the argument begins with tags[,
      // then this is the beginning of the tag that may contain commas
      inTag = true;
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
    } else if (inTag && !escaped && columnText[j] === ']') {
      // when we see a non-escaped quote while inside
      // of a quoted string, we should end it
      inTag = false;
    } else if (quoted && escaped) {
      // when we are inside a quoted string and have
      // begun an escape character, we should end it
      escaped = false;
    } else if ((quoted || inTag) && columnText[j] === ',') {
      // when we are inside a quoted string or tag and see
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
    return parseInt(results[1]!, 10);
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
    // @ts-ignore TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
    const parameters = AGGREGATIONS[func].parameters.map((param: any) => {
      // @ts-ignore TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
      const overrides = AGGREGATIONS[func].getFieldOverrides;
      if (typeof overrides === 'undefined') {
        return param;
      }
      return {
        ...param,
        ...overrides({parameter: param, organization}),
      };
    });

    if (parameters.every((param: any) => typeof param.defaultValue !== 'undefined')) {
      const newField = `${func}(${parameters
        .map((param: any) => param.defaultValue)
        .join(',')})`;
      if (!fields.includes(newField) && !excludeFields.includes(newField)) {
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
    // @ts-ignore TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
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
    // @ts-ignore TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
    return SESSIONS_FIELDS[firstArg].type as AggregationOutputType;
  }

  if (firstArg && STARFISH_FIELDS[firstArg]) {
    return STARFISH_FIELDS[firstArg]!.outputType;
  }

  // @ts-ignore TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
  if (STARFISH_AGGREGATION_FIELDS[funcName]) {
    // @ts-ignore TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
    return STARFISH_AGGREGATION_FIELDS[funcName].defaultOutputType;
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
  // @ts-ignore TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
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
  // @ts-ignore TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
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
    // @ts-ignore TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
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
  // @ts-ignore TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
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

const alignedTypes: ColumnValueType[] = [
  'number',
  'duration',
  'integer',
  'percentage',
  'percent_change',
  'rate',
  'size',
];

export function fieldAlignment(
  columnName: string,
  columnType?: undefined | ColumnValueType,
  metadata?: Record<string, ColumnValueType>
): Alignments {
  let align: Alignments = 'left';
  if (isMRIField(columnName)) {
    return 'right';
  }
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
export function isLegalYAxisType(match: ColumnType | MetricType) {
  return ['number', 'integer', 'duration', 'percentage'].includes(match);
}

export function getSpanOperationName(field: string): string | null {
  const results = field.match(SPAN_OP_BREAKDOWN_PATTERN);
  if (results && results.length >= 2) {
    return results[1]!;
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

// Search categorizations for the new `SearchQueryBuilder` component.
// Each Insights module page will have different points of interest for searching, so use these on a case-by-case basis

export const TRANSACTION_FILTERS: FilterKeySection = {
  value: 'transaction_event_filters',
  label: 'Event',
  children: [
    FieldKey.TRANSACTION_DURATION,
    FieldKey.TRANSACTION_OP,
    FieldKey.TRANSACTION_STATUS,
    FieldKey.TRANSACTION,
    SpanOpBreakdown.SPANS_BROWSER,
    SpanOpBreakdown.SPANS_DB,
    SpanOpBreakdown.SPANS_HTTP,
    SpanOpBreakdown.SPANS_RESOURCE,
    SpanOpBreakdown.SPANS_UI,
  ],
};

export const USER_FILTERS: FilterKeySection = {
  value: 'user_filters',
  label: 'User',
  children: [
    FieldKey.USER,
    FieldKey.USER_DISPLAY,
    FieldKey.USER_EMAIL,
    FieldKey.USER_ID,
    FieldKey.USER_IP,
    FieldKey.USER_USERNAME,
  ],
};

export const GEO_FILTERS: FilterKeySection = {
  value: 'geo_filters',
  label: 'Geo',
  children: [
    FieldKey.GEO_CITY,
    FieldKey.GEO_COUNTRY_CODE,
    FieldKey.GEO_REGION,
    FieldKey.GEO_SUBDIVISION,
  ],
};

export const HTTP_FILTERS: FilterKeySection = {
  value: 'http_filters',
  label: 'HTTP',
  children: [
    FieldKey.HTTP_METHOD,
    FieldKey.HTTP_REFERER,
    FieldKey.HTTP_STATUS_CODE,
    FieldKey.HTTP_URL,
  ],
};

export const WEB_VITAL_FILTERS: FilterKeySection = {
  value: 'web_filters',
  label: 'Web Vitals',
  children: [
    WebVital.CLS,
    WebVital.FCP,
    WebVital.FID,
    WebVital.FP,
    WebVital.INP,
    WebVital.LCP,
    WebVital.REQUEST_TIME,
  ],
};

export const MOBILE_VITAL_FILTERS: FilterKeySection = {
  value: 'mobile_vitals_filters',
  label: 'Mobile Vitals',
  children: [
    MobileVital.APP_START_COLD,
    MobileVital.APP_START_WARM,
    MobileVital.FRAMES_FROZEN,
    MobileVital.FRAMES_FROZEN_RATE,
    MobileVital.FRAMES_SLOW,
    MobileVital.FRAMES_SLOW_RATE,
    MobileVital.FRAMES_TOTAL,
    MobileVital.STALL_COUNT,
    MobileVital.STALL_LONGEST_TIME,
    MobileVital.STALL_PERCENTAGE,
    MobileVital.STALL_TOTAL_TIME,
    MobileVital.TIME_TO_FULL_DISPLAY,
    MobileVital.TIME_TO_INITIAL_DISPLAY,
  ],
};

export const DEVICE_FILTERS: FilterKeySection = {
  value: 'device_filters',
  label: 'Device',
  children: [
    FieldKey.DEVICE_ARCH,
    FieldKey.DEVICE_BATTERY_LEVEL,
    FieldKey.DEVICE_BRAND,
    FieldKey.DEVICE_CHARGING,
    FieldKey.DEVICE_CLASS,
    FieldKey.DEVICE_FAMILY,
    FieldKey.DEVICE_LOCALE,
    // FieldKey.DEVICE_MODEL_ID,
    FieldKey.DEVICE_NAME,
    FieldKey.DEVICE_ONLINE,
    FieldKey.DEVICE_ORIENTATION,
    FieldKey.DEVICE_SCREEN_DENSITY,
    FieldKey.DEVICE_SCREEN_DPI,
    FieldKey.DEVICE_SCREEN_HEIGHT_PIXELS,
    FieldKey.DEVICE_SCREEN_WIDTH_PIXELS,
    FieldKey.DEVICE_SIMULATOR,
    FieldKey.DEVICE_UUID,
  ],
};

export const RELEASE_FILTERS: FilterKeySection = {
  value: 'release_filters',
  label: 'Release',
  children: [
    FieldKey.RELEASE,
    FieldKey.RELEASE_BUILD,
    FieldKey.RELEASE_PACKAGE,
    FieldKey.RELEASE_STAGE,
    FieldKey.RELEASE_VERSION,
  ],
};

export const STACKTRACE_FILTERS: FilterKeySection = {
  value: 'stacktrace_filters',
  label: 'Stacktrace',
  children: [
    FieldKey.STACK_ABS_PATH,
    FieldKey.STACK_COLNO,
    FieldKey.STACK_FILENAME,
    FieldKey.STACK_FUNCTION,
    FieldKey.STACK_IN_APP,
    FieldKey.STACK_LINENO,
    FieldKey.STACK_MODULE,
    FieldKey.STACK_PACKAGE,
    FieldKey.STACK_STACK_LEVEL,
  ],
};

export const ERROR_DETAIL_FILTERS: FilterKeySection = {
  value: 'error_detail_filters',
  label: 'Error',
  children: [
    FieldKey.LEVEL,
    FieldKey.MESSAGE,
    FieldKey.ERROR_TYPE,
    FieldKey.ERROR_VALUE,
    FieldKey.ERROR_MECHANISM,
    FieldKey.ERROR_HANDLED,
    FieldKey.ERROR_UNHANDLED,
    FieldKey.ERROR_RECEIVED,
    FieldKey.ERROR_MAIN_THREAD,
  ],
};

export const MISC_FILTERS: FilterKeySection = {
  value: 'misc_filters',
  label: 'Misc',
  children: [FieldKey.HAS, FieldKey.DIST],
};

export const TRANSACTION_EVENT_FILTERS: FilterKeySection = {
  value: 'transaction_event_filters',
  label: 'Event',
  children: [
    ...TRANSACTION_FILTERS.children,
    ...HTTP_FILTERS.children,
    ...RELEASE_FILTERS.children,
  ],
};

export const ERROR_EVENT_FILTERS: FilterKeySection = {
  value: 'error_event_filters',
  label: 'Event',
  children: [
    ...ERROR_DETAIL_FILTERS.children,
    ...HTTP_FILTERS.children,
    ...RELEASE_FILTERS.children,
  ],
};

export const COMBINED_EVENT_FILTERS: FilterKeySection = {
  value: 'combined_event_filters',
  label: 'Event',
  children: [
    ...TRANSACTION_FILTERS.children,
    ...ERROR_DETAIL_FILTERS.children,
    ...HTTP_FILTERS.children,
    ...RELEASE_FILTERS.children,
  ],
};

export const USER_CONTEXT_FILTERS: FilterKeySection = {
  value: 'user_context_filters',
  label: 'User',
  children: [
    ...USER_FILTERS.children,
    ...GEO_FILTERS.children,
    ...DEVICE_FILTERS.children,
  ],
};

export const PERFORMANCE_FILTERS: FilterKeySection = {
  value: 'performance_filters',
  label: 'Performance',
  children: [...WEB_VITAL_FILTERS.children, ...MOBILE_VITAL_FILTERS.children],
};

export const ALL_INSIGHTS_FILTER_KEY_SECTIONS: FilterKeySection[] = [
  PERFORMANCE_FILTERS,
  TRANSACTION_FILTERS,
  USER_CONTEXT_FILTERS,
];

export const ERRORS_DATASET_FILTER_KEY_SECTIONS: FilterKeySection[] = [
  ERROR_EVENT_FILTERS,
  USER_CONTEXT_FILTERS,
];

export const COMBINED_DATASET_FILTER_KEY_SECTIONS: FilterKeySection[] = [
  PERFORMANCE_FILTERS,
  COMBINED_EVENT_FILTERS,
  USER_CONTEXT_FILTERS,
];

// TODO: In followup PR, add this
// export const PLATFORM_KEY_TO_FILTER_SECTIONS
// will take in a project platform key, and output only the relevant filter key sections.
// This way, users will not be suggested mobile fields for a backend transaction, for example.

export const TYPED_TAG_KEY_RE = /tags\[([^\s]*),([^\s]*)\]/;

export function classifyTagKey(key: string): FieldKind {
  const result = key.match(TYPED_TAG_KEY_RE);
  return result?.[2] === 'number' ? FieldKind.MEASUREMENT : FieldKind.TAG;
}

export function prettifyTagKey(key: string): string {
  const result = key.match(TYPED_TAG_KEY_RE);
  return result?.[1] ?? key;
}

export function prettifyParsedFunction(func: ParsedFunction) {
  const args = func.arguments.map(prettifyTagKey);
  return `${func.name}(${args.join(',')})`;
}
