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
  ALL = '',
  OTHER = 'other',
}

export enum SpanMetricsFields {
  SPAN_OP = 'span.op',
  SPAN_DESCRIPTION = 'span.description',
  SPAN_MODULE = 'span.module',
  SPAN_ACTION = 'span.action',
  SPAN_DOMAIN = 'span.domain',
  SPAN_GROUP = 'span.group',
  SPAN_DURATION = 'span.duration',
  SPAN_SELF_TIME = 'span.self_time',
}

export type SpanMetricsFieldTypes = {
  [SpanMetricsFields.SPAN_OP]: string;
  [SpanMetricsFields.SPAN_DESCRIPTION]: string;
  [SpanMetricsFields.SPAN_MODULE]: string;
  [SpanMetricsFields.SPAN_ACTION]: string;
  [SpanMetricsFields.SPAN_DOMAIN]: string;
  [SpanMetricsFields.SPAN_GROUP]: string;
  [SpanMetricsFields.SPAN_SELF_TIME]: number;
  [SpanMetricsFields.SPAN_DURATION]: number;
};

export enum SpanIndexedFields {
  SPAN_SELF_TIME = 'span.self_time',
  SPAN_GROUP = 'span.group', // Span group computed from the normalized description. Matches the group in the metrics data set
  SPAN_GROUP_RAW = 'span.group_raw', // Span group computed from non-normalized description. Matches the group in the event payload
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
}

export type SpanIndexedFieldTypes = {
  [SpanIndexedFields.SPAN_SELF_TIME]: number;
  [SpanIndexedFields.SPAN_GROUP]: string;
  [SpanIndexedFields.SPAN_GROUP_RAW]: string;
  [SpanIndexedFields.SPAN_MODULE]: string;
  [SpanIndexedFields.SPAN_DESCRIPTION]: string;
  [SpanIndexedFields.SPAN_OP]: string;
  [SpanIndexedFields.ID]: string;
  [SpanIndexedFields.SPAN_ACTION]: string;
  [SpanIndexedFields.TRANSACTION_ID]: string;
  [SpanIndexedFields.TRANSACTION_METHOD]: string;
  [SpanIndexedFields.TRANSACTION_OP]: string;
  [SpanIndexedFields.SPAN_DOMAIN]: string;
  [SpanIndexedFields.TIMESTAMP]: string;
  [SpanIndexedFields.PROJECT]: string;
};

export type Op = SpanIndexedFieldTypes[SpanIndexedFields.SPAN_OP];

export enum StarfishFunctions {
  SPS = 'sps',
  SPM = 'spm',
  SPS_PERCENENT_CHANGE = 'sps_percent_change',
  TIME_SPENT_PERCENTAGE = 'time_spent_percentage',
  HTTP_ERROR_COUNT = 'http_error_count',
}

export const StarfishDatasetFields = {
  [DiscoverDatasets.SPANS_METRICS]: SpanIndexedFields,
  [DiscoverDatasets.SPANS_INDEXED]: SpanIndexedFields,
};

export const STARFISH_AGGREGATION_FIELDS: Record<
  StarfishFunctions,
  FieldDefinition & {defaultOutputType: AggregationOutputType}
> = {
  [StarfishFunctions.SPS]: {
    desc: t('Spans per second'),
    kind: FieldKind.FUNCTION,
    defaultOutputType: 'number',
    valueType: FieldValueType.NUMBER,
  },
  [StarfishFunctions.SPM]: {
    desc: t('Spans per minute'),
    kind: FieldKind.FUNCTION,
    defaultOutputType: 'number',
    valueType: FieldValueType.NUMBER,
  },
  [StarfishFunctions.TIME_SPENT_PERCENTAGE]: {
    desc: t('Span time spent percentage'),
    defaultOutputType: 'percentage',
    kind: FieldKind.FUNCTION,
    valueType: FieldValueType.NUMBER,
  },
  [StarfishFunctions.HTTP_ERROR_COUNT]: {
    desc: t('Count of 5XX http errors'),
    defaultOutputType: 'integer',
    kind: FieldKind.FUNCTION,
    valueType: FieldValueType.NUMBER,
  },
  [StarfishFunctions.SPS_PERCENENT_CHANGE]: {
    desc: t('Spans per second percentage change'),
    defaultOutputType: 'percentage',
    kind: FieldKind.FUNCTION,
    valueType: FieldValueType.NUMBER,
  },
};
