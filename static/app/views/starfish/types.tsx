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
  MODULE = 'module',
  DESCRIPTION = 'description',
  TIMESTAMP = 'timestamp',
  ACTION = 'action',
  TRANSACTION_ID = 'transaction_id',
  DOMAIN = 'domain',
  PROJECT = 'project',
  GROUP = 'span.group',
}

export type SpanIndexedFieldTypes = {
  [SpanIndexedFields.SPAN_SELF_TIME]: number;
  [SpanIndexedFields.TIMESTAMP]: string;
  [SpanIndexedFields.ACTION]: string;
  [SpanIndexedFields.TRANSACTION_ID]: string;
  [SpanIndexedFields.DOMAIN]: string;
  [SpanIndexedFields.PROJECT]: string;
};

export const StarfishDatasetFields = {
  [DiscoverDatasets.SPANS_METRICS]: SpanIndexedFields,
  [DiscoverDatasets.SPANS_INDEXED]: SpanIndexedFields,
};
