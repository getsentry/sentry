import {TraceMetricKnownFieldKey} from './types';

export const AlwaysPresentMetricFields = [
  TraceMetricKnownFieldKey.ID,
  TraceMetricKnownFieldKey.PROJECT_ID,
  TraceMetricKnownFieldKey.ORGANIZATION_ID,
  TraceMetricKnownFieldKey.TIMESTAMP,
  TraceMetricKnownFieldKey.METRIC_NAME,
  TraceMetricKnownFieldKey.METRIC_TYPE,
  TraceMetricKnownFieldKey.METRIC_VALUE,
  TraceMetricKnownFieldKey.METRIC_UNIT,
];

export const AlwaysHiddenMetricFields = [
  TraceMetricKnownFieldKey.ID,
  TraceMetricKnownFieldKey.PROJECT_ID,
  TraceMetricKnownFieldKey.ORGANIZATION_ID,
];

export const QUERY_PAGE_LIMIT = 100;
export const QUERY_PAGE_LIMIT_WITH_AUTO_REFRESH = 25;
export const MAX_METRIC_INGEST_DELAY = 5 * 60 * 1000; // 5 minutes in milliseconds

export const METRIC_TYPES = [
  {value: 'count', label: 'Count'},
  {value: 'gauge', label: 'Gauge'},
  {value: 'distribution', label: 'Distribution'},
  {value: 'set', label: 'Set'},
] as const;
