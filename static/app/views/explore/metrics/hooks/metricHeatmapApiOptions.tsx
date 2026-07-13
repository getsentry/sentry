import {skipToken} from '@tanstack/react-query';

import type {PageFilters} from 'sentry/types/core';
import type {Organization} from 'sentry/types/organization';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {defined} from 'sentry/utils/defined';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {intervalToMilliseconds} from 'sentry/utils/duration/intervalToMilliseconds';
import type {HeatMapSeries} from 'sentry/views/dashboards/widgets/common/types';
import type {SamplingMode} from 'sentry/views/explore/hooks/useProgressiveQuery';
import type {HeatmapWindow} from 'sentry/views/explore/metrics/hooks/partitionHeatmapWindows';
import type {TraceMetric} from 'sentry/views/explore/metrics/metricQuery';
import {createTraceMetricEventsFilter} from 'sentry/views/explore/metrics/utils';

interface MetricHeatmapApiOptions {
  organization: Organization;
  query: string;
  selection: PageFilters;
  /**
   * The window's exact time params (`{start,end}` / `{statsPeriod*}`), spread
   * straight into the request. An absolute (`start`/`end`) window is immutable and
   * caches forever; a relative one refetches each interval as it slides.
   */
  timeParams: HeatmapWindow;
  traceMetric: TraceMetric;
  interval?: string | null;
  sampling?: SamplingMode;
  yBuckets?: number | null;
  yMax?: number;
  yMin?: number;
}

/**
 * Builds one `/events-heatmap/` request for a single window. The caller supplies
 * the range as `timeParams` — the whole selection (fast path) or one partition
 * chunk — so this doesn't care whether it's absolute or relative beyond picking a
 * `staleTime`.
 */
export function metricHeatmapApiOptions({
  organization,
  selection,
  timeParams,
  traceMetric,
  query,
  interval,
  yBuckets,
  yMin,
  yMax,
  sampling,
}: MetricHeatmapApiOptions) {
  const traceMetricFilter = createTraceMetricEventsFilter([traceMetric]);
  const combinedQuery = query ? `${traceMetricFilter} (${query})` : traceMetricFilter;

  const intervalInMilliseconds = defined(interval) ? intervalToMilliseconds(interval) : 0;
  const valid =
    defined(interval) && defined(yBuckets) && yBuckets > 0 && intervalInMilliseconds > 0;

  // Absolute windows are immutable → cache forever. Relative windows slide with
  // `now`, so refetch once per interval to pull the newest bucket.
  const isAbsolute = 'start' in timeParams;
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
        ...timeParams,
        referrer: 'api.explore.tracemetrics-heatmap',
      },
      staleTime,
    }
  );
}
