import {useCallback, useMemo} from 'react';
import {useTheme} from '@emotion/react';

import type {EventsStats, MultiSeriesEventsStats} from 'sentry/types/organization';
import type {EventsMetaType} from 'sentry/utils/discover/eventView';
import {useApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';
import {InsightsBarChartWidget} from 'sentry/views/insights/common/components/insightsBarChartWidget';
import type {DiscoverSeries} from 'sentry/views/insights/common/queries/useDiscoverSeries';
import {usePageFilterChartParams} from 'sentry/views/insights/pages/backend/laravel/utils';

export function JobsWidget({query}: {query?: string}) {
  const organization = useOrganization();
  const pageFilterChartParams = usePageFilterChartParams({
    granularity: 'spans-low',
  });
  const theme = useTheme();

  const {data, isLoading, error} = useApiQuery<MultiSeriesEventsStats>(
    [
      `/organizations/${organization.slug}/events-stats/`,
      {
        query: {
          ...pageFilterChartParams,
          dataset: 'spans',
          field: ['trace.status', 'count(span.duration)'],
          yAxis: ['count(span.duration)'],
          transformAliasToInputFormat: 1,
          query: `span.op:queue.process ${query}`.trim(),
          useRpc: 1,
          topEvents: 10,
        },
      },
    ],
    {staleTime: 0}
  );

  const statsToSeries = useCallback(
    (stats: EventsStats, name: string, color: string): DiscoverSeries => {
      return {
        data: stats.data.map(([time], index) => ({
          name: new Date(time * 1000).toISOString(),
          value: stats.data[index]?.[1][0]?.count! || 0,
        })),
        seriesName: name,
        meta: stats.meta as EventsMetaType,
        color,
      };
    },
    []
  );

  const timeSeries = useMemo<DiscoverSeries[]>(() => {
    if (!data) {
      return [];
    }

    const okJobs = data.ok ? statsToSeries(data.ok, 'ok', theme.gray200) : undefined;
    const failedJobs = data.internal_error
      ? statsToSeries(data.internal_error, 'internal_error', theme.error)
      : undefined;
    return [okJobs, failedJobs].filter(series => !!series);
  }, [data, statsToSeries, theme.error, theme.gray200]);

  return (
    <InsightsBarChartWidget
      title="Jobs"
      stacked
      isLoading={isLoading}
      error={error}
      aliases={{
        ok: 'Processed',
        internal_error: 'Failed',
      }}
      series={timeSeries}
    />
  );
}
