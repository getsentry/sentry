import {skipToken, useQuery} from '@tanstack/react-query';

import {normalizeDateTimeParams} from 'sentry/components/pageFilters/parse';
import {usePageFilters} from 'sentry/components/pageFilters/usePageFilters';
import {DEFAULT_STATS_PERIOD} from 'sentry/constants';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {parsePeriodToHours} from 'sentry/utils/duration/parsePeriodToHours';
import {useOrganization} from 'sentry/utils/useOrganization';
import type {HeatMapSeries} from 'sentry/views/dashboards/widgets/common/types';
import type {TraceMetric} from 'sentry/views/explore/metrics/metricQuery';
import {createTraceMetricEventsFilter} from 'sentry/views/explore/metrics/utils';
import {useQueryParamsQuery} from 'sentry/views/explore/queryParams/context';

// Hard-coded for the MVP. Backend ignores `xBuckets` when `xAxis === 'time'`,
// so the actual horizontal bucket count is determined by `interval`.
const Y_BUCKETS = 60;
const X_BUCKETS = 200;

interface AxisMeta {
  end: number | null;
  name: string;
  start: number | null;
  bucketCount?: number;
  bucketSize?: number;
}

interface HeatmapApiResponse {
  meta: {
    dataset: string;
    xAxis: AxisMeta;
    yAxis: AxisMeta;
    zAxis: AxisMeta;
  };
  values: Array<{xAxis: number; yAxis: number; zAxis: number}>;
}

interface UseMetricHeatmapOptions {
  enabled: boolean;
  traceMetric: TraceMetric;
}

export function useMetricHeatmap({traceMetric, enabled}: UseMetricHeatmapOptions) {
  const organization = useOrganization();
  const {selection} = usePageFilters();
  const userQuery = useQueryParamsQuery();

  const traceMetricFilter = createTraceMetricEventsFilter([traceMetric]);
  const combinedQuery = userQuery
    ? `${traceMetricFilter} ${userQuery}`
    : traceMetricFilter;

  // Aim for ~50 horizontal buckets when xAxis is time. The backend uses
  // `interval` to determine x_buckets, so derive interval from the date range.
  const interval = computeIntervalForBuckets(selection.datetime, X_BUCKETS);

  const queryResult = useQuery(
    apiOptions.as<HeatmapApiResponse>()(
      '/organizations/$organizationIdOrSlug/events-heatmap/',
      {
        path: enabled ? {organizationIdOrSlug: organization.slug} : skipToken,
        query: {
          dataset: DiscoverDatasets.TRACEMETRICS,
          xAxis: 'time',
          yAxis: 'value',
          zAxis: 'count()',
          yBuckets: Y_BUCKETS,
          interval,
          query: combinedQuery,
          project: selection.projects,
          environment: selection.environments,
          ...normalizeDateTimeParams(selection.datetime),
          referrer: 'api.explore.tracemetrics-heatmap',
        },
        staleTime: 30_000,
      }
    )
  );

  const heatMapSeries = queryResult.data
    ? toHeatMapSeries(queryResult.data, traceMetric)
    : undefined;

  return {
    heatMapSeries,
    isPending: queryResult.isPending,
    isFetching: queryResult.isFetching,
    error: queryResult.error,
  };
}

function toHeatMapSeries(
  response: HeatmapApiResponse,
  traceMetric: TraceMetric
): HeatMapSeries {
  // The backend doesn't return `valueType` / `valueUnit` for the y-axis, so we
  // approximate from the metric's unit. This is a known limitation; we hard-code
  // `'duration'` only when the unit looks like a time unit, otherwise `'number'`.
  const valueType = inferValueType(traceMetric.unit);
  const valueUnit = (traceMetric.unit ??
    null) as HeatMapSeries['meta']['yAxis']['valueUnit'];

  return {
    meta: {
      xAxis: {
        name: response.meta.xAxis.name,
        start: response.meta.xAxis.start ?? 0,
        end: response.meta.xAxis.end ?? 0,
        bucketCount: response.meta.xAxis.bucketCount ?? 0,
        bucketSize: response.meta.xAxis.bucketSize ?? 0,
      },
      yAxis: {
        name: response.meta.yAxis.name,
        start: response.meta.yAxis.start ?? 0,
        end: response.meta.yAxis.end ?? 0,
        bucketCount: response.meta.yAxis.bucketCount ?? 0,
        bucketSize: response.meta.yAxis.bucketSize ?? 0,
        valueType,
        valueUnit,
      },
      zAxis: {
        name: response.meta.zAxis.name,
        start: response.meta.zAxis.start ?? 0,
        end: response.meta.zAxis.end ?? 0,
      },
    },
    values: response.values.map(value => ({
      xAxis: value.xAxis,
      yAxis: value.yAxis,
      zAxis: value.zAxis,
    })),
  };
}

const TIME_UNITS = new Set([
  'nanosecond',
  'microsecond',
  'millisecond',
  'second',
  'minute',
  'hour',
  'day',
  'week',
]);

const SIZE_UNITS = new Set([
  'bit',
  'byte',
  'kibibyte',
  'mebibyte',
  'gibibyte',
  'tebibyte',
  'pebibyte',
  'exbibyte',
  'kilobyte',
  'megabyte',
  'gigabyte',
  'terabyte',
  'petabyte',
  'exabyte',
]);

function inferValueType(
  unit: string | undefined
): HeatMapSeries['meta']['yAxis']['valueType'] {
  if (unit && TIME_UNITS.has(unit)) {
    return 'duration';
  }
  if (unit && SIZE_UNITS.has(unit)) {
    return 'size';
  }
  return 'number';
}

// Allowed interval buckets the `/events-heatmap/` endpoint accepts (seconds).
// Must stay in sync with `ALLOWED_INTERVALS` in the backend's `get_rollup`.
const ALLOWED_INTERVAL_SECONDS = [
  15, 30, 60, 120, 300, 600, 900, 1800, 3600, 7200, 10800, 14400, 21600, 43200, 86400,
];

function computeIntervalForBuckets(
  datetime: ReturnType<typeof usePageFilters>['selection']['datetime'],
  bucketCount: number
): string {
  let totalSeconds = 0;
  if (datetime.start && datetime.end) {
    totalSeconds = Math.max(
      0,
      (new Date(datetime.end).getTime() - new Date(datetime.start).getTime()) / 1000
    );
  } else {
    const period = datetime.period ?? DEFAULT_STATS_PERIOD;
    totalSeconds = parsePeriodToHours(period) * 3600;
  }

  const target = totalSeconds > 0 ? totalSeconds / bucketCount : 60;

  // Pick the smallest allowed interval >= target so we don't exceed `bucketCount`.
  const snapped =
    ALLOWED_INTERVAL_SECONDS.find(s => s >= target) ??
    ALLOWED_INTERVAL_SECONDS[ALLOWED_INTERVAL_SECONDS.length - 1]!;

  return `${snapped}s`;
}
