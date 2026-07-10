import {skipToken} from '@tanstack/react-query';

import {normalizeDateTimeParams} from 'sentry/components/pageFilters/parse';
import type {PageFilters} from 'sentry/types/core';
import type {Organization} from 'sentry/types/organization';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {getUtcDateString} from 'sentry/utils/dates';
import {defined} from 'sentry/utils/defined';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {intervalToMilliseconds} from 'sentry/utils/duration/intervalToMilliseconds';
import type {HeatMapSeries} from 'sentry/views/dashboards/widgets/common/types';
import type {TraceMetric} from 'sentry/views/explore/metrics/metricQuery';
import {createTraceMetricEventsFilter} from 'sentry/views/explore/metrics/utils';

interface MetricHeatmapApiOptions {
  enabled: boolean;
  organization: Organization;
  query: string;
  selection: PageFilters;
  traceMetric: TraceMetric;
  /**
   * Chunk end override (ms). When provided (with `start`), the request covers
   * this concrete window instead of the page-filter range, and `statsPeriod` is
   * omitted. Used for chunked (Phase B) fetching.
   */
  end?: number;
  interval?: string | null;
  /**
   * Overrides the default `staleTime`. Chunked fetching sets immutable historical
   * chunks to `Infinity` and only the trailing (live) chunk to the interval.
   */
  staleTime?: number;
  /**
   * Chunk start override (ms). See `end`.
   */
  start?: number;
  yBuckets?: number | null;
  /**
   * Pins the upper y-axis bound so parallel chunks share identical buckets.
   */
  yMax?: number;
  /**
   * Pins the lower y-axis bound so parallel chunks share identical buckets.
   */
  yMin?: number;
}

export function metricHeatmapApiOptions({
  organization,
  selection,
  traceMetric,
  query,
  enabled,
  interval,
  yBuckets,
  yMin,
  yMax,
  start: startOverride,
  end: endOverride,
  staleTime: staleTimeOverride,
}: MetricHeatmapApiOptions) {
  const traceMetricFilter = createTraceMetricEventsFilter([traceMetric]);
  const combinedQuery = query ? `${traceMetricFilter} (${query})` : traceMetricFilter;

  const intervalInMilliseconds = defined(interval) ? intervalToMilliseconds(interval) : 0;
  const valid =
    defined(interval) && defined(yBuckets) && yBuckets > 0 && intervalInMilliseconds > 0;

  // A concrete chunk window takes precedence over the page-filter range. When
  // used, `statsPeriod` is dropped so the two don't fight.
  const usesChunkWindow = defined(startOverride) && defined(endOverride);

  const normalized = normalizeDateTimeParams(selection.datetime);
  const start = usesChunkWindow ? getUtcDateString(startOverride) : normalized.start;
  const end = usesChunkWindow ? getUtcDateString(endOverride) : normalized.end;
  const statsPeriod = usesChunkWindow ? undefined : normalized.statsPeriod;

  const usesRelativeDateRange = !defined(start) && !defined(end) && defined(statsPeriod);

  const defaultStaleTime =
    usesRelativeDateRange && intervalInMilliseconds !== 0
      ? intervalInMilliseconds
      : Infinity;

  return apiOptions.as<HeatMapSeries>()(
    '/organizations/$organizationIdOrSlug/events-heatmap/',
    {
      path: !enabled || !valid ? skipToken : {organizationIdOrSlug: organization.slug},
      query: {
        dataset: DiscoverDatasets.TRACEMETRICS,
        xAxis: 'time',
        yAxis: 'value',
        zAxis: 'count()',
        yBuckets,
        interval,
        yMin,
        yMax,
        query: combinedQuery,
        project: selection.projects,
        environment: selection.environments,
        start,
        end,
        statsPeriod,
        referrer: 'api.explore.tracemetrics-heatmap',
      },
      staleTime: staleTimeOverride ?? defaultStaleTime,
    }
  );
}
