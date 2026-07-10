import {skipToken} from '@tanstack/react-query';

import {normalizeDateTimeParams} from 'sentry/components/pageFilters/parse';
import type {PageFilters} from 'sentry/types/core';
import type {Organization} from 'sentry/types/organization';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {defined} from 'sentry/utils/defined';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {intervalToMilliseconds} from 'sentry/utils/duration/intervalToMilliseconds';
import type {TraceMetric} from 'sentry/views/explore/metrics/metricQuery';
import type {TraceMetricEventsResult} from 'sentry/views/explore/metrics/types';
import {createTraceMetricEventsFilter} from 'sentry/views/explore/metrics/utils';

const MIN_VALUE_FIELD = 'min(value)';
const MAX_VALUE_FIELD = 'max(value)';

interface MetricHeatmapBoundsApiOptions {
  enabled: boolean;
  organization: Organization;
  query: string;
  selection: PageFilters;
  traceMetric: TraceMetric;
  interval?: string | null;
}

/**
 * Phase A of chunked heat map fetching: one cheap aggregate that learns the
 * global y-axis domain (`min(value)`/`max(value)`) over the full range, so every
 * time-chunk can pin identical, aligned buckets.
 *
 * This reuses the existing `/events/` endpoint — it's the same min/max the heat
 * map endpoint computes internally via `query_y_bucket_ranges`, just issued
 * directly so we can share one domain across parallel chunk requests. No
 * `sampling` param is sent, matching the heat map endpoint's own bounds query
 * (which runs at the request's default sampling mode).
 */
export function metricHeatmapBoundsApiOptions({
  organization,
  selection,
  traceMetric,
  query,
  enabled,
  interval,
}: MetricHeatmapBoundsApiOptions) {
  const traceMetricFilter = createTraceMetricEventsFilter([traceMetric]);
  const combinedQuery = query ? `${traceMetricFilter} (${query})` : traceMetricFilter;

  const {start, end, statsPeriod} = normalizeDateTimeParams(selection.datetime);
  const usesRelativeDateRange = !defined(start) && !defined(end) && defined(statsPeriod);
  const intervalInMilliseconds = defined(interval) ? intervalToMilliseconds(interval) : 0;

  return apiOptions.as<TraceMetricEventsResult>()(
    '/organizations/$organizationIdOrSlug/events/',
    {
      path: enabled ? {organizationIdOrSlug: organization.slug} : skipToken,
      query: {
        dataset: DiscoverDatasets.TRACEMETRICS,
        field: [MIN_VALUE_FIELD, MAX_VALUE_FIELD],
        query: combinedQuery,
        project: selection.projects,
        environment: selection.environments,
        start,
        end,
        statsPeriod,
        referrer: 'api.explore.tracemetrics-heatmap-bounds',
      },
      staleTime:
        usesRelativeDateRange && intervalInMilliseconds !== 0
          ? intervalInMilliseconds
          : Infinity,
    }
  );
}

export interface HeatMapBounds {
  yMax: number;
  yMin: number;
}

/**
 * Reduces the single-row bounds response to a `{yMin, yMax}` domain, or `null`
 * when the range has no data (so the caller can render an empty grid rather than
 * pinning a bogus domain).
 */
export function reduceHeatMapBounds(
  result: TraceMetricEventsResult
): HeatMapBounds | null {
  const row = result.data?.[0];
  if (!row) {
    return null;
  }
  const yMin = Number(row[MIN_VALUE_FIELD]);
  const yMax = Number(row[MAX_VALUE_FIELD]);
  if (!Number.isFinite(yMin) || !Number.isFinite(yMax)) {
    return null;
  }
  return {yMin, yMax};
}
