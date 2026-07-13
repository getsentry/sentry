import {skipToken} from '@tanstack/react-query';

import {normalizeDateTimeParams} from 'sentry/components/pageFilters/parse';
import type {PageFilters} from 'sentry/types/core';
import type {Organization} from 'sentry/types/organization';
import type {ApiResponse} from 'sentry/utils/api/apiFetch';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {defined} from 'sentry/utils/defined';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {intervalToMilliseconds} from 'sentry/utils/duration/intervalToMilliseconds';
import type {SamplingMode} from 'sentry/views/explore/hooks/useProgressiveQuery';
import type {TraceMetric} from 'sentry/views/explore/metrics/metricQuery';
import type {TraceMetricEventsResult} from 'sentry/views/explore/metrics/types';
import {createTraceMetricEventsFilter} from 'sentry/views/explore/metrics/utils';

const MIN_VALUE_FIELD = 'min(value)';
const MAX_VALUE_FIELD = 'max(value)';

export interface MetricBounds {
  max: number;
  min: number;
}

interface MetricBoundsApiOptions {
  enabled: boolean;
  organization: Organization;
  query: string;
  selection: PageFilters;
  traceMetric: TraceMetric;
  interval?: string | null;
  /**
   * `min`/`max` are the extremes of the rows actually SCANNED (they're not
   * extrapolated under downsampling), so the bounds depend on the sampling tier.
   * Pass the SAME sampling you'll use on whatever query you pin these onto — that
   * mirrors the heat map endpoint, which computes its own bounds at its data
   * query's sampling mode. Omit for the backend default (NORMAL).
   */
  sampling?: SamplingMode;
}

/**
 * One cheap aggregate that learns a metric's value range (`min(value)` /
 * `max(value)`) over the current selection, reduced to `{min, max}` (or `null`
 * when the range has no data). Generic — anything that needs a metric's extent.
 */
export function metricBoundsApiOptions({
  organization,
  selection,
  traceMetric,
  query,
  enabled,
  interval,
  sampling,
}: MetricBoundsApiOptions) {
  const traceMetricFilter = createTraceMetricEventsFilter([traceMetric]);
  const combinedQuery = query ? `${traceMetricFilter} (${query})` : traceMetricFilter;

  const {start, end, statsPeriod} = normalizeDateTimeParams(selection.datetime);
  const usesRelativeDateRange = !defined(start) && !defined(end) && defined(statsPeriod);
  const intervalInMilliseconds = defined(interval) ? intervalToMilliseconds(interval) : 0;

  return {
    ...apiOptions.as<TraceMetricEventsResult>()(
      '/organizations/$organizationIdOrSlug/events/',
      {
        path: enabled ? {organizationIdOrSlug: organization.slug} : skipToken,
        query: {
          dataset: DiscoverDatasets.TRACEMETRICS,
          field: [MIN_VALUE_FIELD, MAX_VALUE_FIELD],
          sampling,
          query: combinedQuery,
          project: selection.projects,
          environment: selection.environments,
          start,
          end,
          statsPeriod,
          referrer: 'api.explore.tracemetrics-bounds',
        },
        staleTime:
          usesRelativeDateRange && intervalInMilliseconds !== 0
            ? intervalInMilliseconds
            : Infinity,
      }
    ),
    // Reduce the single-row response to `{min, max}` (or null when empty) so
    // consumers get the domain directly, not the raw events payload.
    select: (response: ApiResponse<TraceMetricEventsResult>) =>
      reduceMetricBounds(response.json),
  };
}

/**
 * Reduces the single-row bounds response to a `{min, max}` range, or `null` when
 * the range has no data (so the caller can skip pinning a bogus domain).
 */
function reduceMetricBounds(result: TraceMetricEventsResult): MetricBounds | null {
  const row = result.data?.[0];
  if (!row) {
    return null;
  }
  const min = Number(row[MIN_VALUE_FIELD]);
  const max = Number(row[MAX_VALUE_FIELD]);
  if (!Number.isFinite(min) || !Number.isFinite(max)) {
    return null;
  }
  return {min, max};
}
