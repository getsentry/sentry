import type {SelectOption} from 'sentry/components/core/compactSelect';
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

export const OPTIONS_BY_TYPE: Record<string, Array<SelectOption<string>>> = {
  counter: [
    {
      label: 'per_second',
      value: 'per_second',
    },
    {
      label: 'per_minute',
      value: 'per_minute',
    },
    {
      label: 'sum',
      value: 'sum',
    },
  ],
  distribution: [
    {
      label: 'p50',
      value: 'p50',
    },
    {
      label: 'p75',
      value: 'p75',
    },
    {
      label: 'p90',
      value: 'p90',
    },
    {
      label: 'p95',
      value: 'p95',
    },
    {
      label: 'p99',
      value: 'p99',
    },
    {
      label: 'avg',
      value: 'avg',
    },
    {
      label: 'min',
      value: 'min',
    },
    {
      label: 'max',
      value: 'max',
    },
    {
      label: 'sum',
      value: 'sum',
    },
    {
      label: 'count',
      value: 'count',
    },
    {
      label: 'per_second',
      value: 'per_second',
    },
    {
      label: 'per_minute',
      value: 'per_minute',
    },
  ],
  gauge: [
    {
      label: 'min',
      value: 'min',
    },
    {
      label: 'max',
      value: 'max',
    },
    {
      label: 'avg',
      value: 'avg',
    },
    {
      label: 'last',
      value: 'last',
    },
    {
      label: 'per_second',
      value: 'per_second',
    },
    {
      label: 'per_minute',
      value: 'per_minute',
    },
  ],
};

export const DEFAULT_YAXIS_BY_TYPE: Record<string, string> = {
  counter: 'per_second',
  distribution: 'p75',
  gauge: 'avg',
};
