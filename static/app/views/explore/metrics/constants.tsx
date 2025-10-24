import {
  TraceMetricKnownFieldKey,
  type TraceMetricFieldKey,
} from 'sentry/views/explore/metrics/types';

const AlwaysHiddenTraceMetricFields: TraceMetricFieldKey[] = [
  TraceMetricKnownFieldKey.ID,
  TraceMetricKnownFieldKey.ORGANIZATION_ID,
  TraceMetricKnownFieldKey.SEVERITY_NUMBER,
  TraceMetricKnownFieldKey.ITEM_TYPE,
  TraceMetricKnownFieldKey.TIMESTAMP_PRECISE,
  TraceMetricKnownFieldKey.PROJECT_ID,
  'project_id', // these are both aliases that might show up
];

/**
 * These are fields that should be hidden in metric details view when receiving all data from the API.
 */
export const HiddenTraceMetricDetailFields: TraceMetricFieldKey[] = [
  ...AlwaysHiddenTraceMetricFields,
  TraceMetricKnownFieldKey.SPAN_ID,
  'sentry.span_id',

  // deprecated/otel fields that clutter the UI
  TraceMetricKnownFieldKey.TIMESTAMP_NANOS,
  'sentry.observed_timestamp_nanos',
  'tags[sentry.trace_flags,number]',
  'metric.name',
  'metric.type',
];
