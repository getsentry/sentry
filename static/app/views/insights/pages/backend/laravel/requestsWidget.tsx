import {useCallback, useMemo} from 'react';
import {useTheme} from '@emotion/react';

import type {EventsStats, MultiSeriesEventsStats} from 'sentry/types/organization';
import {useApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';
import {InsightsBarChartWidget} from 'sentry/views/insights/common/components/insightsBarChartWidget';
import type {DiscoverSeries} from 'sentry/views/insights/common/queries/useDiscoverSeries';
import {usePageFilterChartParams} from 'sentry/views/insights/pages/backend/laravel/utils';

export function RequestsWidget({query}: {query?: string}) {
  const organization = useOrganization();
  const pageFilterChartParams = usePageFilterChartParams({granularity: 'spans-low'});
  const theme = useTheme();

  const {data, isLoading, error} = useApiQuery<MultiSeriesEventsStats>(
    [
      `/organizations/${organization.slug}/events-stats/`,
      {
        query: {
          ...pageFilterChartParams,
          dataset: 'spans',
          field: ['trace.status', 'count(span.duration)'],
          yAxis: 'count(span.duration)',
          orderby: '-count(span.duration)',
          partial: 1,
          query: `span.op:http.server ${query}`.trim(),
          useRpc: 1,
          topEvents: 10,
        },
      },
    ],
    {staleTime: 0}
  );

  const combineTimeSeries = useCallback(
    (
      seriesData: EventsStats[],
      color: string,
      fieldName: string
    ): DiscoverSeries | undefined => {
      const firstSeries = seriesData[0];
      if (!firstSeries) {
        return undefined;
      }

      return {
        data: firstSeries.data.map(([time], index) => ({
          name: new Date(time * 1000).toISOString(),
          value: seriesData.reduce(
            (acc, series) => acc + series.data[index]?.[1][0]?.count!,
            0
          ),
        })),
        seriesName: fieldName,
        meta: {
          fields: {
            [fieldName]: 'integer',
          },
          units: {},
        },
        color,
      } satisfies DiscoverSeries;
    },
    []
  );

  const timeSeries = useMemo(() => {
    return [
      combineTimeSeries(
        [data?.ok].filter(series => !!series),
        theme.gray200,
        '2xx'
      ),
      combineTimeSeries(
        [data?.invalid_argument, data?.internal_error].filter(series => !!series),
        theme.error,
        '5xx'
      ),
    ].filter(series => !!series);
  }, [
    combineTimeSeries,
    data?.internal_error,
    data?.invalid_argument,
    data?.ok,
    theme.error,
    theme.gray200,
  ]);

  return (
    <InsightsBarChartWidget
      title="Requests"
      isLoading={isLoading}
      error={error}
      series={timeSeries}
      stacked
    />
  );
}
