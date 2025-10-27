import {
  TraceMetricKnownFieldKey,
  type TraceMetricFieldKey,
} from 'sentry/views/explore/metrics/types';

const AlwaysHiddenTraceMetricFields: TraceMetricFieldKey[] = [
  TraceMetricKnownFieldKey.ID,
  TraceMetricKnownFieldKey.ORGANIZATION_ID,
  TraceMetricKnownFieldKey.ITEM_TYPE,
  TraceMetricKnownFieldKey.TIMESTAMP_PRECISE,
  TraceMetricKnownFieldKey.PROJECT_ID,
  TraceMetricKnownFieldKey.OLD_PROJECT_ID,
];

/**
 * These are fields that should be hidden in metric details view when receiving all data from the API.
 */
export const HiddenTraceMetricDetailFields: TraceMetricFieldKey[] = [
  ...AlwaysHiddenTraceMetricFields,
  TraceMetricKnownFieldKey.SPAN_ID,

  // deprecated/otel fields that clutter the UI
  TraceMetricKnownFieldKey.TIMESTAMP_NANOS,
  TraceMetricKnownFieldKey.OBSERVED_TIMESTAMP_NANOS,
  TraceMetricKnownFieldKey.TRACE_FLAGS,
  TraceMetricKnownFieldKey.METRIC_NAME,
  TraceMetricKnownFieldKey.METRIC_TYPE,
];

export const HiddenTraceMetricSearchFields: TraceMetricFieldKey[] = [
  ...AlwaysHiddenTraceMetricFields,
  TraceMetricKnownFieldKey.METRIC_NAME,
  TraceMetricKnownFieldKey.METRIC_TYPE,
];

export const HiddenTraceMetricGroupByFields: TraceMetricFieldKey[] = [
  ...HiddenTraceMetricSearchFields,
];
