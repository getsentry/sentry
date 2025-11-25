import type {SelectOption} from 'sentry/components/core/compactSelect';
import {
  TraceMetricKnownFieldKey,
  VirtualTableSampleColumnKey,
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

export const AlwaysPresentTraceMetricFields: TraceMetricFieldKey[] = [
  TraceMetricKnownFieldKey.ID,
  TraceMetricKnownFieldKey.PROJECT_ID,
  TraceMetricKnownFieldKey.TRACE,
  TraceMetricKnownFieldKey.SPAN_ID,
  TraceMetricKnownFieldKey.OLD_SPAN_ID,
  TraceMetricKnownFieldKey.METRIC_TYPE,
  TraceMetricKnownFieldKey.METRIC_NAME,
  TraceMetricKnownFieldKey.TIMESTAMP,
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
  TraceMetricKnownFieldKey.METRIC_UNIT,
  TraceMetricKnownFieldKey.CLIENT_SAMPLE_RATE,
];

export const HiddenTraceMetricSearchFields: TraceMetricFieldKey[] = [
  ...AlwaysHiddenTraceMetricFields,
  TraceMetricKnownFieldKey.METRIC_NAME,
  TraceMetricKnownFieldKey.METRIC_TYPE,
  TraceMetricKnownFieldKey.METRIC_UNIT,
];

export const HiddenTraceMetricGroupByFields: TraceMetricFieldKey[] = [
  ...HiddenTraceMetricSearchFields,
];

export const TraceSamplesTableStatColumns: VirtualTableSampleColumnKey[] = [
  VirtualTableSampleColumnKey.LOGS,
  VirtualTableSampleColumnKey.SPANS,
  VirtualTableSampleColumnKey.ERRORS,
];

export const TraceSamplesTableColumns: Array<
  TraceMetricFieldKey | VirtualTableSampleColumnKey
> = [
  VirtualTableSampleColumnKey.EXPAND_ROW,
  TraceMetricKnownFieldKey.TIMESTAMP,
  TraceMetricKnownFieldKey.TRACE,
  ...TraceSamplesTableStatColumns,
  TraceMetricKnownFieldKey.METRIC_VALUE,
];

export const TraceSamplesTableEmbeddedColumns: Array<
  TraceMetricFieldKey | VirtualTableSampleColumnKey
> = [
  VirtualTableSampleColumnKey.EXPAND_ROW,
  TraceMetricKnownFieldKey.TIMESTAMP,
  VirtualTableSampleColumnKey.PROJECT_BADGE,
  TraceMetricKnownFieldKey.METRIC_NAME,
  TraceMetricKnownFieldKey.METRIC_TYPE,
  TraceMetricKnownFieldKey.METRIC_VALUE,
];

export const NoPaddingColumns: VirtualTableSampleColumnKey[] = [
  VirtualTableSampleColumnKey.EXPAND_ROW,
  VirtualTableSampleColumnKey.PROJECT_BADGE,
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

/**
 * Query parameter key for controlling the metrics drawer state.
 * When this parameter is set to 'true', the metrics drawer should open automatically.
 */
export const METRICS_DRAWER_QUERY_PARAM = 'metricsDrawer';
