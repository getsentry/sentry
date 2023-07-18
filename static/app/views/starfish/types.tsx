import {t} from 'sentry/locale';
import {AggregationOutputType} from 'sentry/utils/discover/fields';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {FieldDefinition, FieldKind, FieldValueType} from 'sentry/utils/fields';

export enum StarfishType {
  BACKEND = 'backend',
  MOBILE = 'mobile',
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

export enum SpanIndexedFields {
  SPAN_SELF_TIME = 'span.self_time',
  SPAN_GROUP = 'span.group',
  SPAN_MODULE = 'span.module',
  SPAN_DESCRIPTION = 'span.description',
  SPAN_OP = 'span.op',
  ID = 'span_id',
  SPAN_ACTION = 'span.action',
  TRANSACTION_ID = 'transaction.id',
  SPAN_DOMAIN = 'span.domain',
  TIMESTAMP = 'timestamp',
  GROUP = 'span.group',
  PROJECT = 'project',
}

export enum StarfishFunctions {
  SPS = 'sps',
  SPS_PERCENENT_CHANGE = 'sps_percent_change',
  TIME_SPENT_PERCENTAGE = 'time_spent_percentage',
  HTTP_ERROR_COUNT = 'http_error_count',
}

export type SpanIndexedFieldTypes = {
  [SpanIndexedFields.SPAN_SELF_TIME]: number;
  [SpanIndexedFields.TIMESTAMP]: string;
  [SpanIndexedFields.SPAN_ACTION]: string;
  [SpanIndexedFields.TRANSACTION_ID]: string;
  [SpanIndexedFields.SPAN_DOMAIN]: string;
  [SpanIndexedFields.PROJECT]: string;
  [SpanIndexedFields.ID]: string;
};

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
