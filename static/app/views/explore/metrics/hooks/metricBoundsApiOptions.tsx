import {normalizeDateTimeParams} from 'sentry/components/pageFilters/parse';
import type {PageFilters} from 'sentry/types/core';
import type {Organization} from 'sentry/types/organization';
import type {ApiResponse} from 'sentry/utils/api/apiFetch';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {defined} from 'sentry/utils/defined';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import type {SamplingMode} from 'sentry/views/explore/hooks/useProgressiveQuery';
import type {TraceMetric} from 'sentry/views/explore/metrics/metricQuery';
import type {TraceMetricEventsResult} from 'sentry/views/explore/metrics/types';
import {createTraceMetricEventsFilter} from 'sentry/views/explore/metrics/utils';

export interface MetricBounds {
  max: number;
  min: number;
}

interface MetricBoundsApiOptions {
  organization: Organization;
  query: string;
  selection: PageFilters;
  traceMetric: TraceMetric;
  sampling?: SamplingMode;
}

/**
 * Run an aggregate to get the Y-axis range of a given trace metric over the
 * current selection. Useful for generating preview data, or aligning other
 * fetches.
 */
export function metricBoundsApiOptions({
  organization,
  selection,
  traceMetric,
  query,
  sampling,
}: MetricBoundsApiOptions) {
  const traceMetricFilter = createTraceMetricEventsFilter([traceMetric]);
  const combinedQuery = query ? `${traceMetricFilter} (${query})` : traceMetricFilter;

  const {start, end, statsPeriod} = normalizeDateTimeParams(selection.datetime);
  // Absolute ranges are immutable → cache forever. Relative ranges drift as new
  // extreme values arrive, but the y-domain moves slowly and refetching re-pins
  // (and re-fetches) every chunk, so cache it a while instead of recomputing on
  // every mount/focus (which `staleTime: 0` would do).
  const staleTime =
    defined(start) && defined(end) ? Infinity : RELATIVE_BOUNDS_STALE_TIME;

  return {
    ...apiOptions.as<TraceMetricEventsResult>()(
      '/organizations/$organizationIdOrSlug/events/',
      {
        path: {organizationIdOrSlug: organization.slug},
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
        staleTime,
      }
    ),
    select: (response: ApiResponse<TraceMetricEventsResult>): MetricBounds | null => {
      const row = response.json.data?.[0];

      if (!row) {
        return null;
      }

      const min = Number(row[MIN_VALUE_FIELD]);
      const max = Number(row[MAX_VALUE_FIELD]);

      if (!Number.isFinite(min) || !Number.isFinite(max)) {
        return null;
      }

      return {min, max};
    },
  };
}

const MIN_VALUE_FIELD = 'min(value)';
const MAX_VALUE_FIELD = 'max(value)';

// How long a relative range's bounds stay fresh before refetching.
const RELATIVE_BOUNDS_STALE_TIME = 5 * 60 * 1000; // 5 minutes
