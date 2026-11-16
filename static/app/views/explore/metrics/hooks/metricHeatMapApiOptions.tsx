import type {PageFilters} from 'sentry/types/core';
import type {Organization} from 'sentry/types/organization';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {heatMapApiOptions} from 'sentry/views/explore/hooks/heatMapApiOptions';
import type {SamplingMode} from 'sentry/views/explore/hooks/useProgressiveQuery';
import type {TraceMetric} from 'sentry/views/explore/metrics/metricQuery';
import {createTraceMetricEventsFilter} from 'sentry/views/explore/metrics/utils';

import type {HeatMapWindow} from './partitionHeatMapWindows';

interface MetricHeatMapApiOptions {
  organization: Organization;
  query: string;
  selection: PageFilters;
  timeWindow: HeatMapWindow;
  traceMetric: TraceMetric;
  interval?: string | null;
  sampling?: SamplingMode;
  yBuckets?: number | null;
  yMax?: number;
  yMin?: number;
}

export function metricHeatMapApiOptions({
  traceMetric,
  query,
  ...options
}: MetricHeatMapApiOptions) {
  const traceMetricFilter = createTraceMetricEventsFilter([traceMetric]);

  return heatMapApiOptions({
    ...options,
    dataset: DiscoverDatasets.TRACEMETRICS,
    yAxis: 'value',
    query: query ? `${traceMetricFilter} (${query})` : traceMetricFilter,
    referrer: 'api.explore.tracemetrics-heatmap',
  });
}
