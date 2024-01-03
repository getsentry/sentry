import {t} from 'sentry/locale';
import {AggregationOutputType} from 'sentry/utils/discover/fields';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {FieldDefinition, FieldKind, FieldValueType} from 'sentry/utils/fields';

export enum StarfishType {
  BACKEND = 'backend',
  MOBILE = 'mobile',
  FRONTEND = 'frontend',
}

export enum ModuleName {
  HTTP = 'http',
  DB = 'db',
  RESOURCE = 'resource',
  ALL = '',
  OTHER = 'other',
}

export enum SpanMetricsField {
  SPAN_OP = 'span.op',
  SPAN_DESCRIPTION = 'span.description',
  SPAN_MODULE = 'span.module',
  SPAN_ACTION = 'span.action',
  SPAN_DOMAIN = 'span.domain',
  SPAN_GROUP = 'span.group',
  SPAN_DURATION = 'span.duration',
  SPAN_SELF_TIME = 'span.self_time',
  PROJECT_ID = 'project.id',
  TRANSACTION = 'transaction',
  RESOURCE_RENDER_BLOCKING_STATUS = 'resource.render_blocking_status',
  HTTP_RESPONSE_CONTENT_LENGTH = 'http.response_content_length',
  HTTP_DECODED_RESPONSE_CONTENT_LENGTH = 'http.decoded_response_content_length',
  HTTP_RESPONSE_TRANSFER_SIZE = 'http.response_transfer_size',
  FILE_EXTENSION = 'file_extension',
}

export type SpanNumberFields =
  | SpanMetricsField.SPAN_SELF_TIME
  | SpanMetricsField.SPAN_DURATION
  | SpanMetricsField.HTTP_DECODED_RESPONSE_CONTENT_LENGTH
  | SpanMetricsField.HTTP_RESPONSE_CONTENT_LENGTH
  | SpanMetricsField.HTTP_RESPONSE_TRANSFER_SIZE;

export type SpanStringFields =
  | 'span.op'
  | 'span.description'
  | 'span.module'
  | 'span.action'
  | 'span.domain'
  | 'span.group'
  | 'transaction'
  | 'transaction.method'
  | 'release';

export type SpanMetricsQueryFilters = {
  [Field in SpanStringFields]?: string;
} & {
  [SpanMetricsField.PROJECT_ID]?: string;
};

export type SpanStringArrayFields = 'span.domain';

export const COUNTER_AGGREGATES = ['avg', 'min', 'max', 'p100'] as const;
export const DISTRIBUTION_AGGREGATES = ['p50', 'p75', 'p95', 'p99'] as const;

export const AGGREGATES = [...COUNTER_AGGREGATES, ...DISTRIBUTION_AGGREGATES] as const;

export type Aggregate = (typeof AGGREGATES)[number];

export const SPAN_FUNCTIONS = [
  'sps',
  'spm',
  'count',
  'time_spent_percentage',
  'http_error_count',
] as const;

export type SpanFunctions = (typeof SPAN_FUNCTIONS)[number];

export type MetricsResponse = {
  [Property in SpanNumberFields as `avg(${Property})`]: number;
} & {
  [Property in SpanNumberFields as `sum(${Property})`]: number;
} & {
  [Property in SpanFunctions as `${Property}()`]: number;
} & {
  [Property in SpanStringFields as `${Property}`]: string;
} & {
  [Property in SpanStringArrayFields as `${Property}`]: string[];
} & {
  ['project.id']: number;
};

export type MetricsFilters = {
  [Property in SpanStringFields as `${Property}`]?: string | string[];
};

export type MetricsProperty = keyof MetricsResponse;

export enum SpanIndexedField {
  RESOURCE_RENDER_BLOCKING_STATUS = 'resource.render_blocking_status',
  HTTP_RESPONSE_CONTENT_LENGTH = 'http.response_content_length',
  SPAN_SELF_TIME = 'span.self_time',
  SPAN_GROUP = 'span.group', // Span group computed from the normalized description. Matches the group in the metrics data set
  SPAN_MODULE = 'span.module',
  SPAN_DESCRIPTION = 'span.description',
  SPAN_OP = 'span.op',
  ID = 'span_id',
  SPAN_ACTION = 'span.action',
  TRANSACTION_ID = 'transaction.id',
  TRANSACTION_METHOD = 'transaction.method',
  TRANSACTION_OP = 'transaction.op',
  SPAN_DOMAIN = 'span.domain',
  TIMESTAMP = 'timestamp',
  PROJECT = 'project',
  PROJECT_ID = 'project_id',
  PROFILE_ID = 'profile_id',
  TRANSACTION = 'transaction',
}

export type SpanIndexedFieldTypes = {
  [SpanIndexedField.SPAN_SELF_TIME]: number;
  [SpanIndexedField.SPAN_GROUP]: string;
  [SpanIndexedField.SPAN_MODULE]: string;
  [SpanIndexedField.SPAN_DESCRIPTION]: string;
  [SpanIndexedField.SPAN_OP]: string;
  [SpanIndexedField.ID]: string;
  [SpanIndexedField.SPAN_ACTION]: string;
  [SpanIndexedField.TRANSACTION_ID]: string;
  [SpanIndexedField.TRANSACTION_METHOD]: string;
  [SpanIndexedField.TRANSACTION_OP]: string;
  [SpanIndexedField.SPAN_DOMAIN]: string[];
  [SpanIndexedField.TIMESTAMP]: string;
  [SpanIndexedField.PROJECT]: string;
  [SpanIndexedField.PROJECT_ID]: number;
  [SpanIndexedField.PROFILE_ID]: string;
  [SpanIndexedField.RESOURCE_RENDER_BLOCKING_STATUS]: '' | 'non-blocking' | 'blocking';
  [SpanIndexedField.HTTP_RESPONSE_CONTENT_LENGTH]: string;
};

export type Op = SpanIndexedFieldTypes[SpanIndexedField.SPAN_OP];

export enum SpanFunction {
  SPS = 'sps',
  SPM = 'spm',
  TIME_SPENT_PERCENTAGE = 'time_spent_percentage',
  HTTP_ERROR_COUNT = 'http_error_count',
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
};
