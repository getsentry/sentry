import {t} from 'sentry/locale';
import type {AggregationOutputType} from 'sentry/utils/discover/fields';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import type {FieldDefinition} from 'sentry/utils/fields';
import {FieldKind, FieldValueType} from 'sentry/utils/fields';
import {SpanMetricsField, SpanIndexedField} from 'sentry/views/insights/spanFields';

export enum StarfishType {
  BACKEND = 'backend',
  MOBILE = 'mobile',
  FRONTEND = 'frontend',
}

export enum ModuleName {
  HTTP = 'http',
  DB = 'db',
  CACHE = 'cache',
  VITAL = 'vital',
  QUEUE = 'queue',
  SCREEN_LOAD = 'screen_load',
  APP_START = 'app_start',
  RESOURCE = 'resource',
  AI = 'ai',
  MOBILE_UI = 'mobile-ui',
  ALL = '',
  OTHER = 'other',
}

export type SpanNumberFields =
  | SpanMetricsField.AI_TOTAL_COST
  | SpanMetricsField.AI_TOTAL_TOKENS_USED
  | SpanMetricsField.SPAN_SELF_TIME
  | SpanMetricsField.SPAN_DURATION
  | SpanMetricsField.HTTP_DECODED_RESPONSE_CONTENT_LENGTH
  | SpanMetricsField.HTTP_RESPONSE_CONTENT_LENGTH
  | SpanMetricsField.HTTP_RESPONSE_TRANSFER_SIZE
  | SpanMetricsField.MESSAGING_MESSAGE_RECEIVE_LATENCY
  | SpanMetricsField.CACHE_ITEM_SIZE;

export type SpanStringFields =
  | 'span.op'
  | 'span.description'
  | 'span.module'
  | 'span.action'
  | 'span.group'
  | 'span.category'
  | 'transaction'
  | 'transaction.method'
  | 'release'
  | 'os.name'
  | 'span.status_code'
  | 'span.ai.pipeline.group'
  | 'project'
  | 'messaging.destination.name';

export type SpanMetricsQueryFilters = {
  [Field in SpanStringFields]?: string;
} & {
  [SpanMetricsField.PROJECT_ID]?: string;
  [SpanMetricsField.SPAN_DOMAIN]?: string;
};

export type SpanIndexedQueryFilters = {
  [Field in SpanStringFields]?: string;
} & {
  [SpanIndexedField.PROJECT_ID]?: string;
};

export type SpanStringArrayFields = 'span.domain';

export const COUNTER_AGGREGATES = ['sum', 'avg', 'min', 'max', 'p100'] as const;
export const DISTRIBUTION_AGGREGATES = ['p50', 'p75', 'p95', 'p99'] as const;

export const AGGREGATES = [...COUNTER_AGGREGATES, ...DISTRIBUTION_AGGREGATES] as const;

export type Aggregate = (typeof AGGREGATES)[number];

export type ConditionalAggregate =
  | `avg_if`
  | `count_op`
  | 'trace_status_rate'
  | 'time_spent_percentage';

export const SPAN_FUNCTIONS = [
  'sps',
  'spm',
  'count',
  'time_spent_percentage',
  'http_response_rate',
  'http_error_count',
  'cache_hit_rate',
  'cache_miss_rate',
  'sum',
] as const;

const BREAKPOINT_CONDITIONS = ['less', 'greater'] as const;
type BreakpointCondition = (typeof BREAKPOINT_CONDITIONS)[number];

type RegressionFunctions = [
  `regression_score(${string},${string})`,
  `avg_by_timestamp(${string},${BreakpointCondition},${string})`,
  `epm_by_timestamp(${BreakpointCondition},${string})`,
][number];

type SpanAnyFunction = `any(${string})`;

export type SpanFunctions = (typeof SPAN_FUNCTIONS)[number];

export type SpanMetricsResponse = {
  [Property in SpanNumberFields as `${Aggregate}(${Property})`]: number;
} & {
  [Property in SpanFunctions as `${Property}()`]: number;
} & {
  [Property in SpanStringFields as `${Property}`]: string;
} & {
  [Property in SpanStringArrayFields as `${Property}`]: string[];
} & {
  // TODO: This should include all valid HTTP codes or just all integers
  'http_response_rate(2)': number;
  'http_response_rate(3)': number;
  'http_response_rate(4)': number;
  'http_response_rate(5)': number;
} & {
  ['project']: string;
  ['project.id']: number;
} & {
  [Function in RegressionFunctions]: number;
} & {
  [Function in SpanAnyFunction]: string;
} & {
  [Property in ConditionalAggregate as
    | `${Property}(${string})`
    | `${Property}(${string},${string})`
    | `${Property}(${string},${string},${string})`]: number;
};

export type MetricsFilters = {
  [Property in SpanStringFields as `${Property}`]?: string | string[];
};

export type SpanMetricsProperty = keyof SpanMetricsResponse;

export type SpanIndexedResponse = {
  [SpanIndexedField.ENVIRONMENT]: string;
  [SpanIndexedField.RELEASE]: string;
  [SpanIndexedField.SDK_NAME]: string;
  [SpanIndexedField.SPAN_CATEGORY]: string;
  [SpanIndexedField.SPAN_DURATION]: number;
  [SpanIndexedField.SPAN_SELF_TIME]: number;
  [SpanIndexedField.SPAN_GROUP]: string;
  [SpanIndexedField.SPAN_MODULE]: string;
  [SpanIndexedField.SPAN_DESCRIPTION]: string;
  [SpanIndexedField.SPAN_OP]: string;
  [SpanIndexedField.SPAN_AI_PIPELINE_GROUP]: string;
  [SpanIndexedField.SPAN_STATUS]:
    | 'ok'
    | 'cancelled'
    | 'unknown'
    | 'invalid_argument'
    | 'deadline_exceeded'
    | 'not_found'
    | 'already_exists'
    | 'permission_denied'
    | 'resource_exhausted'
    | 'failed_precondition'
    | 'aborted'
    | 'out_of_range'
    | 'unimplemented'
    | 'internal_error'
    | 'unavailable'
    | 'data_loss'
    | 'unauthenticated';
  [SpanIndexedField.ID]: string;
  [SpanIndexedField.SPAN_ACTION]: string;
  [SpanIndexedField.TRACE]: string;
  [SpanIndexedField.TRANSACTION]: string;
  [SpanIndexedField.TRANSACTION_ID]: string;
  [SpanIndexedField.TRANSACTION_METHOD]: string;
  [SpanIndexedField.TRANSACTION_OP]: string;
  [SpanIndexedField.SPAN_DOMAIN]: string[];
  [SpanIndexedField.RAW_DOMAIN]: string;
  [SpanIndexedField.TIMESTAMP]: string;
  [SpanIndexedField.PROJECT]: string;
  [SpanIndexedField.PROJECT_ID]: number;
  [SpanIndexedField.PROFILE_ID]: string;
  [SpanIndexedField.RESOURCE_RENDER_BLOCKING_STATUS]: '' | 'non-blocking' | 'blocking';
  [SpanIndexedField.HTTP_RESPONSE_CONTENT_LENGTH]: string;
  [SpanIndexedField.ORIGIN_TRANSACTION]: string;
  [SpanIndexedField.REPLAY_ID]: string;
  [SpanIndexedField.BROWSER_NAME]: string;
  [SpanIndexedField.USER]: string;
  [SpanIndexedField.USER_ID]: string;
  [SpanIndexedField.USER_EMAIL]: string;
  [SpanIndexedField.USER_USERNAME]: string;
  [SpanIndexedField.INP]: number;
  [SpanIndexedField.INP_SCORE]: number;
  [SpanIndexedField.INP_SCORE_WEIGHT]: number;
  [SpanIndexedField.TOTAL_SCORE]: number;
  [SpanIndexedField.RESPONSE_CODE]: string;
  [SpanIndexedField.CACHE_HIT]: '' | 'true' | 'false';
  [SpanIndexedField.CACHE_ITEM_SIZE]: number;
  [SpanIndexedField.TRACE_STATUS]: string;
  [SpanIndexedField.MESSAGING_MESSAGE_ID]: string;
  [SpanIndexedField.MESSAGING_MESSAGE_BODY_SIZE]: number;
  [SpanIndexedField.MESSAGING_MESSAGE_RECEIVE_LATENCY]: number;
  [SpanIndexedField.MESSAGING_MESSAGE_RETRY_COUNT]: number;
  [SpanIndexedField.MESSAGING_MESSAGE_DESTINATION_NAME]: string;
};

export type SpanIndexedPropery = keyof SpanIndexedResponse;

// TODO: When convenient, remove this alias and use `IndexedResponse` everywhere
export type SpanIndexedFieldTypes = SpanIndexedResponse;

export type Op = SpanIndexedFieldTypes[SpanIndexedField.SPAN_OP];

export enum SpanFunction {
  SPS = 'sps',
  SPM = 'spm',
  TIME_SPENT_PERCENTAGE = 'time_spent_percentage',
  HTTP_ERROR_COUNT = 'http_error_count',
  HTTP_RESPONSE_RATE = 'http_response_rate',
  CACHE_HIT_RATE = 'cache_hit_rate',
  CACHE_MISS_RATE = 'cache_miss_rate',
  COUNT_OP = 'count_op',
  TRACE_STATUS_RATE = 'trace_status_rate',
}

export const StarfishDatasetFields = {
  [DiscoverDatasets.SPANS_METRICS]: SpanIndexedField,
  [DiscoverDatasets.SPANS_INDEXED]: SpanIndexedField,
};

export const STARFISH_AGGREGATION_FIELDS: Record<
  SpanFunction,
  FieldDefinition & {defaultOutputType: AggregationOutputType}
> = {
  [SpanFunction.SPS]: {
    desc: t('Spans per second'),
    kind: FieldKind.FUNCTION,
    defaultOutputType: 'number',
    valueType: FieldValueType.NUMBER,
  },
  [SpanFunction.SPM]: {
    desc: t('Spans per minute'),
    kind: FieldKind.FUNCTION,
    defaultOutputType: 'number',
    valueType: FieldValueType.NUMBER,
  },
  [SpanFunction.TIME_SPENT_PERCENTAGE]: {
    desc: t('Span time spent percentage'),
    defaultOutputType: 'percentage',
    kind: FieldKind.FUNCTION,
    valueType: FieldValueType.NUMBER,
  },
  [SpanFunction.HTTP_ERROR_COUNT]: {
    desc: t('Count of 5XX http errors'),
    defaultOutputType: 'integer',
    kind: FieldKind.FUNCTION,
    valueType: FieldValueType.NUMBER,
  },
  [SpanFunction.HTTP_RESPONSE_RATE]: {
    desc: t('Percentage of HTTP responses by code'),
    defaultOutputType: 'percentage',
    kind: FieldKind.FUNCTION,
    valueType: FieldValueType.NUMBER,
  },
  [SpanFunction.CACHE_HIT_RATE]: {
    desc: t('Percentage of cache hits'),
    defaultOutputType: 'percentage',
    kind: FieldKind.FUNCTION,
    valueType: FieldValueType.NUMBER,
  },
  [SpanFunction.CACHE_MISS_RATE]: {
    desc: t('Percentage of cache misses'),
    defaultOutputType: 'percentage',
    kind: FieldKind.FUNCTION,
    valueType: FieldValueType.NUMBER,
  },
  [SpanFunction.COUNT_OP]: {
    desc: t('Count of spans with matching operation'),
    defaultOutputType: 'integer',
    kind: FieldKind.FUNCTION,
    valueType: FieldValueType.NUMBER,
  },
  [SpanFunction.TRACE_STATUS_RATE]: {
    desc: t('Percentage of spans with matching trace status'),
    defaultOutputType: 'percentage',
    kind: FieldKind.FUNCTION,
    valueType: FieldValueType.NUMBER,
  },
};

// TODO - add more functions and fields, combine shared ones, etc

export const METRICS_FUNCTIONS = ['count'] as const;

export enum MetricsFields {
  TRANSACTION_DURATION = 'transaction.duration',
  TRANSACTION = 'transaction',
}

export type MetricsNumberFields = MetricsFields.TRANSACTION_DURATION;

export type MetricsStringFields = MetricsFields.TRANSACTION;

export type MetricsFunctions = (typeof METRICS_FUNCTIONS)[number];

export type MetricsResponse = {
  [Property in MetricsNumberFields as `${Aggregate}(${Property})`]: number;
} & {
  [Property in MetricsStringFields as `${Property}`]: string;
};

export type MetricsProperty = keyof MetricsResponse;

export type MetricsQueryFilters = {
  [Field in MetricsStringFields]?: string;
} & {
  [SpanIndexedField.PROJECT_ID]?: string;
};
