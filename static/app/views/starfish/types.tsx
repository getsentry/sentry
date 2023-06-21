import {DiscoverDatasets} from 'sentry/utils/discover/types';

export enum ModuleName {
  HTTP = 'http',
  DB = 'db',
  NONE = 'none',
  ALL = '',
}

export enum SpanMetricsFields {
  SPAN_OP = 'span.op',
  SPAN_DESCRIPTION = 'span.description',
  SPAN_ACTION = 'span.action',
  SPAN_DOMAIN = 'span.domain',
  SPAN_DURATION = 'span.duration',
  SPAN_SELF_TIME = 'span.self_time',
}

export enum SpanIndexedFields {
  SPAN_SELF_TIME = 'span.self_time',
  MODULE = 'span.module',
  ID = 'span_id',
  DESCRIPTION = 'span.description',
  TIMESTAMP = 'timestamp',
  ACTION = 'span.action',
  TRANSACTION_ID = 'transaction.id',
  DOMAIN = 'span.domain',
  GROUP = 'span.group',
  PROJECT = 'project',
}

export type SpanIndexedFieldTypes = {
  [SpanIndexedFields.SPAN_SELF_TIME]: number;
  [SpanIndexedFields.TIMESTAMP]: string;
  [SpanIndexedFields.ACTION]: string;
  [SpanIndexedFields.TRANSACTION_ID]: string;
  [SpanIndexedFields.DOMAIN]: string;
  [SpanIndexedFields.PROJECT]: string;
  [SpanIndexedFields.ID]: string;
};

export const StarfishDatasetFields = {
  [DiscoverDatasets.SPANS_METRICS]: SpanIndexedFields,
  [DiscoverDatasets.SPANS_INDEXED]: SpanIndexedFields,
};
