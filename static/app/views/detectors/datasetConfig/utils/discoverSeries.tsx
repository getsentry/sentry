import type {Series} from 'sentry/types/echarts';
import type {EventsStats, Organization} from 'sentry/types/organization';
import type {DiscoverDatasets} from 'sentry/utils/discover/types';
import getDuration from 'sentry/utils/duration/getDuration';
import type {ApiQueryKey} from 'sentry/utils/queryClient';
import {
  EAP_EXTRAPOLATION_MODE_MAP,
  ExtrapolationMode,
} from 'sentry/views/alerts/rules/metric/types';
import {SAMPLING_MODE} from 'sentry/views/explore/hooks/useProgressiveQuery';

/**
 * Transform EventsStats API response into Series format for AreaChart
 * Based on dashboards transformEventsStatsToSeries function
 */
export function transformEventsStatsToSeries(
  stats: EventsStats | undefined,
  seriesName: string
): Series {
  if (!stats?.data?.length) {
    return {
      seriesName,
      data: [],
    };
  }

  return {
    seriesName,
    data: stats.data.map(([timestamp, counts]) => {
      return {
        name: timestamp * 1000, // Convert to milliseconds
        value: counts.reduce((acc, {count}) => acc + count, 0),
      };
    }),
  };
}

/**
 * Transform comparisonCount from events-stats API response into comparison series for % change alerts
 */
export function transformEventsStatsComparisonSeries(
  stats: EventsStats | undefined
): Series {
  // Check if any data points have comparisonCount
  const hasComparisonData = stats?.data.some(([, counts]) =>
    counts.some(count => count.comparisonCount !== undefined)
  );

  if (!hasComparisonData || !stats?.data?.length) {
    return {
      seriesName: 'Comparison',
      data: [],
    };
  }

  return {
    seriesName: 'Comparison',
    data: stats.data.map(([timestampSeconds, counts]) => {
      return {
        name: timestampSeconds * 1000,
        value: counts.reduce((acc, {comparisonCount}) => acc + (comparisonCount ?? 0), 0),
      };
    }),
  };
}

interface DiscoverSeriesQueryOptions {
  /**
   * The aggregate to use for the series query. eg: `count()`
   */
  aggregate: string;
  /**
   * Comparison delta in seconds for % change alerts
   */
  comparisonDelta: number | undefined;
  dataset: DiscoverDatasets;
  environment: string;
  /**
   * Metric detector interval in seconds
   */
  interval: number;
  organization: Organization;
  projectId: string;
  /**
   * The filter query. eg: `span.op:http`
   */
  query: string;
  end?: string | null;
  /**
   * Extra query parameters to pass
   */
  extra?: {
    useOnDemandMetrics: 'true';
  };
  extrapolationMode?: ExtrapolationMode;
  start?: string | null;
  /**
   * Relative time period for the query. Example: '7d'.
   */
  statsPeriod?: string | null;
}

export function getDiscoverSeriesQueryOptions({
  aggregate,
  environment,
  interval,
  organization,
  projectId,
  query,
  dataset,
  statsPeriod,
  comparisonDelta,
  start,
  end,
  extrapolationMode,
}: DiscoverSeriesQueryOptions): ApiQueryKey {
  return [
    `/organizations/${organization.slug}/events-stats/`,
    {
      query: {
        interval: getDuration(interval, 0, false, true),
        project: [projectId],
        yAxis: aggregate,
        dataset,
        includePrevious: false,
        includeAllArgs: true,
        partial: '1',
        statsPeriod,
        start,
        end,
        sampling:
          extrapolationMode === ExtrapolationMode.NONE
            ? SAMPLING_MODE.HIGH_ACCURACY
            : SAMPLING_MODE.NORMAL,
        extrapolationMode: extrapolationMode
          ? EAP_EXTRAPOLATION_MODE_MAP[extrapolationMode]
          : undefined,
        ...(environment && {environment: [environment]}),
        ...(query && {query}),
        ...(comparisonDelta && {comparisonDelta}),
      },
    },
  ];
}
