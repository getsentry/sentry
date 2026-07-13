import {skipToken} from '@tanstack/react-query';

import {normalizeDateTimeParams} from 'sentry/components/pageFilters/parse';
import type {PageFilters} from 'sentry/types/core';
import type {Organization} from 'sentry/types/organization';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {defined} from 'sentry/utils/defined';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {intervalToMilliseconds} from 'sentry/utils/duration/intervalToMilliseconds';
import type {HeatMapSeries} from 'sentry/views/dashboards/widgets/common/types';
import type {SamplingMode} from 'sentry/views/explore/hooks/useProgressiveQuery';
import type {TraceMetric} from 'sentry/views/explore/metrics/metricQuery';
import {createTraceMetricEventsFilter} from 'sentry/views/explore/metrics/utils';

interface MetricHeatmapApiOptions {
  organization: Organization;
  query: string;
  selection: PageFilters;
  traceMetric: TraceMetric;
  /**
   * Defaults to true. Callers decide enablement by whether they build the query
   * at all (e.g. an empty array from a disabled fan-out); this only skip-tokens
   * an individual request when a caller explicitly disables it.
   */
  enabled?: boolean;
  interval?: string | null;
  sampling?: SamplingMode;
  staleTime?: number;
  yBuckets?: number | null;
  yMax?: number;
  yMin?: number;
}

/**
 * Builds one `/events-heatmap/` request over `selection`. The caller supplies the
 * range via `selection.datetime` — the whole selection (fast path) or a single
 * pinned chunk window (Phase B); both resolve through the same
 * `normalizeDateTimeParams` path, so an absolute window sends `start`/`end` and a
 * relative range sends `statsPeriod`.
 */
export function metricHeatmapApiOptions({
  organization,
  selection,
  traceMetric,
  query,
  enabled = true,
  interval,
  yBuckets,
  yMin,
  yMax,
  sampling,
  staleTime: staleTimeOverride,
}: MetricHeatmapApiOptions) {
  const traceMetricFilter = createTraceMetricEventsFilter([traceMetric]);
  const combinedQuery = query ? `${traceMetricFilter} (${query})` : traceMetricFilter;

  const intervalInMilliseconds = defined(interval) ? intervalToMilliseconds(interval) : 0;
  const valid =
    defined(interval) && defined(yBuckets) && yBuckets > 0 && intervalInMilliseconds > 0;

  const {start, end, statsPeriod} = normalizeDateTimeParams(selection.datetime);

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
