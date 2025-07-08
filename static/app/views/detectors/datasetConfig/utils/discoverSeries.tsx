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

export function getDiscoverSeriesQueryOptions({
  aggregate,
  environment,
  interval,
  organization,
  projectId,
  query,
  dataset,
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
        // TODO: Pass period
        statsPeriod: '7d',
        ...(environment && {environment: [environment]}),
        ...(query && {query}),
      },
    },
  ];
}
