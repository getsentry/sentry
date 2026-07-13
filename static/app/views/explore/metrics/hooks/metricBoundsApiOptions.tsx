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
 * One cheap aggregate that learns a metric's value range (`min(value)` /
 * `max(value)`) over the current selection, reduced to `{min, max}` (or `null`
 * when the range has no data). Generic — anything that needs a metric's extent.
 *
 * Disable it at the call site (`useQuery({...metricBoundsApiOptions(), enabled})`).
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
  // extreme values arrive, so let them refetch when the query is re-triggered.
  const staleTime = defined(start) && defined(end) ? Infinity : 0;

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
    // Reduce the single-row response to `{min, max}` (or null when empty) so
    // consumers get the domain directly, not the raw events payload.
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
