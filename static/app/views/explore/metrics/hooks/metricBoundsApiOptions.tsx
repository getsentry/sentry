import {skipToken} from '@tanstack/react-query';

import {normalizeDateTimeParams} from 'sentry/components/pageFilters/parse';
import type {PageFilters} from 'sentry/types/core';
import type {Organization} from 'sentry/types/organization';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {defined} from 'sentry/utils/defined';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {intervalToMilliseconds} from 'sentry/utils/duration/intervalToMilliseconds';
import {SAMPLING_MODE} from 'sentry/views/explore/hooks/useProgressiveQuery';
import type {TraceMetric} from 'sentry/views/explore/metrics/metricQuery';
import type {TraceMetricEventsResult} from 'sentry/views/explore/metrics/types';
import {createTraceMetricEventsFilter} from 'sentry/views/explore/metrics/utils';

const MIN_VALUE_FIELD = 'min(value)';
const MAX_VALUE_FIELD = 'max(value)';

interface MetricBoundsApiOptions {
  enabled: boolean;
  organization: Organization;
  query: string;
  selection: PageFilters;
  traceMetric: TraceMetric;
  interval?: string | null;
}

/**
 * One cheap aggregate that learns a metric's value range (`min(value)` /
 * `max(value)`) over the current selection — the exact extremes across every row.
 *
 * Runs at HIGHEST_ACCURACY (no downsampling) so the bounds are exact. EAP picks a
 * downsampling tier per request from the query's time range + estimated row count
 * (snuba `outcomes_based.py`), and `min`/`max` are NOT extrapolated: on a
 * downsampled tier they're the extremes of *scanned* rows, biased inward. Callers
 * that pin a domain to these bounds (e.g. the chunked heat map, so parallel
 * chunks share aligned buckets) rely on them enclosing every row, so do not
 * "optimize" this back to default sampling.
 */
export function metricBoundsApiOptions({
  organization,
  selection,
  traceMetric,
  query,
  enabled,
  interval,
}: MetricBoundsApiOptions) {
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
        // Exact extremes — see the docstring. Must not downsample.
        sampling: SAMPLING_MODE.HIGH_ACCURACY,
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
  );
}

export interface MetricBounds {
  max: number;
  min: number;
}

/**
 * Reduces the single-row bounds response to a `{min, max}` range, or `null` when
 * the range has no data (so the caller can skip pinning a bogus domain).
 */
export function reduceMetricBounds(result: TraceMetricEventsResult): MetricBounds | null {
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
