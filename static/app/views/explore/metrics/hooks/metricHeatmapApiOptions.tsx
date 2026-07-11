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
import type {SamplingMode} from 'sentry/views/explore/hooks/useProgressiveQuery';
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
   * EAP sampling mode. Chunked (Phase B) requests pass HIGHEST_ACCURACY so every
   * chunk runs on the same undownsampled tier (TIER_1); see the docstring below.
   * The unchunked fast path leaves this undefined (default sampling), matching
   * the pre-chunking behavior.
   */
  sampling?: SamplingMode;
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

/**
 * Builds one `/events-heatmap/` request — either the whole selection (fast path)
 * or a single pinned, windowed chunk (Phase B).
 *
 * Chunked callers pass `sampling: HIGHEST_ACCURACY`. EAP picks a downsampling
 * tier per request from the query's time range + estimated row count, so
 * differently-sized chunks could otherwise land on different tiers — making the
 * extrapolated `count()` values noisy/non-uniform across the grid (visible
 * brightness seams between chunks) and potentially inconsistent with the pinned
 * bounds. Forcing TIER_1 keeps every chunk exact and uniform. The speedup comes
 * from smaller parallel windows, not downsampling — so if a chunk is too slow,
 * shrink the chunks (the `computeTimeChunks` policy), do NOT re-enable per-chunk
 * downsampling. See the backend-contract note in `useChunkedTimeRangeQuery`.
 */
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
  sampling,
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
        sampling,
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
