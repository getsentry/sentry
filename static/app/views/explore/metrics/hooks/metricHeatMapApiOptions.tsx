import {skipToken} from '@tanstack/react-query';

import type {PageFilters} from 'sentry/types/core';
import type {Organization} from 'sentry/types/organization';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {defined} from 'sentry/utils/defined';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {intervalToMilliseconds} from 'sentry/utils/duration/intervalToMilliseconds';
import type {HeatMapSeries} from 'sentry/views/dashboards/widgets/common/types';
import type {SamplingMode} from 'sentry/views/explore/hooks/useProgressiveQuery';
import type {HeatMapWindow} from 'sentry/views/explore/metrics/hooks/partitionHeatMapWindows';
import type {TraceMetric} from 'sentry/views/explore/metrics/metricQuery';
import {createTraceMetricEventsFilter} from 'sentry/views/explore/metrics/utils';

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

/**
 * Builds API options for a request to `/events-heatmap/`. Requires a "window"
 * since Heat Map visualizations load their data in chunks.
 */
export function metricHeatMapApiOptions({
  organization,
  selection,
  timeWindow,
  traceMetric,
  query,
  interval,
  yBuckets,
  yMin,
  yMax,
  sampling,
}: MetricHeatMapApiOptions) {
  const traceMetricFilter = createTraceMetricEventsFilter([traceMetric]);
  const combinedQuery = query ? `${traceMetricFilter} (${query})` : traceMetricFilter;

  const intervalInMilliseconds = defined(interval) ? intervalToMilliseconds(interval) : 0;
  const valid =
    defined(interval) && intervalInMilliseconds > 0 && defined(yBuckets) && yBuckets > 0;

  // Absolute windows are immutable → cache forever. Relative windows slide with
  // `now`, so refetch once per interval to pull the newest bucket.
  const isAbsolute = 'start' in timeWindow;
  const staleTime = isAbsolute ? Infinity : intervalInMilliseconds;

  return apiOptions.as<HeatMapSeries>()(
    '/organizations/$organizationIdOrSlug/events-heatmap/',
    {
      path: valid ? {organizationIdOrSlug: organization.slug} : skipToken,
      query: {
        dataset: DiscoverDatasets.TRACEMETRICS,
        xAxis: 'time',
        yAxis: 'value',
        zAxis: 'count()',
        yBuckets,
        interval,
        yMin,
        yMax,
        sampling,
        query: combinedQuery,
        project: selection.projects,
        environment: selection.environments,
        ...timeWindow,
        referrer: 'api.explore.tracemetrics-heatmap',
      },
      staleTime,
    }
  );
}
