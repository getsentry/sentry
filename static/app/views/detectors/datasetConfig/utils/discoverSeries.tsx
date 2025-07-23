import type {Series} from 'sentry/types/echarts';
import type {EventsStats} from 'sentry/types/organization';
import getDuration from 'sentry/utils/duration/getDuration';
import type {ApiQueryKey} from 'sentry/utils/queryClient';
import type {DetectorSeriesQueryOptions} from 'sentry/views/detectors/datasetConfig/base';

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
 * Transform comparisonCount from EventsStats API response into comparison series for % change alerts
 * Based on the metric alerts transformComparisonTimeseriesData function
 */
export function transformEventsStatsComparisonSeries(
  stats: EventsStats | undefined,
  _seriesName: string, // Renamed from seriesName to _seriesName to fix linter
  comparisonDelta?: number
): Series {
  const comparisonName = comparisonDelta
    ? `Previous ${getDuration(comparisonDelta * 1000)}` // getDuration expects milliseconds
    : 'Comparison';

  if (!stats?.data?.length) {
    return {
      seriesName: comparisonName,
      data: [],
    };
  }

  // Check if any data points have comparisonCount
  const hasComparisonData = stats.data.some(([, counts]) =>
    counts.some(count => count.comparisonCount !== undefined)
  );

  if (!hasComparisonData) {
    return {
      seriesName: comparisonName,
      data: [],
    };
  }

  return {
    seriesName: comparisonName,
    data: stats.data.map(([timestamp, counts]) => {
      return {
        name: timestamp * 1000, // Convert to milliseconds
        value: counts.reduce((acc, {comparisonCount}) => acc + (comparisonCount ?? 0), 0),
      };
    }),
  };
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
}: DetectorSeriesQueryOptions): ApiQueryKey {
  return [
    `/organizations/${organization.slug}/events-stats/`,
    {
      query: {
        interval: getDuration(interval, 0, false, true),
        project: [projectId],
        yAxis: aggregate,
        dataset,
        includePrevious: false,
        partial: true,
        includeAllArgs: true,
        statsPeriod,
        ...(environment && {environment: [environment]}),
        ...(query && {query}),
        ...(comparisonDelta && {comparisonDelta}),
      },
    },
  ];
}
