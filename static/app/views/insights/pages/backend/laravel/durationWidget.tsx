import {useCallback, useMemo} from 'react';

import {CHART_PALETTE} from 'sentry/constants/chartPalette';
import type {MultiSeriesEventsStats} from 'sentry/types/organization';
import type {EventsMetaType} from 'sentry/utils/discover/eventView';
import {useApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';
import {InsightsLineChartWidget} from 'sentry/views/insights/common/components/insightsLineChartWidget';
import type {DiscoverSeries} from 'sentry/views/insights/common/queries/useDiscoverSeries';
import {usePageFilterChartParams} from 'sentry/views/insights/pages/backend/laravel/utils';

export function DurationWidget({query}: {query?: string}) {
  const organization = useOrganization();
  const pageFilterChartParams = usePageFilterChartParams();

  const {data, isLoading, error} = useApiQuery<MultiSeriesEventsStats>(
    [
      `/organizations/${organization.slug}/events-stats/`,
      {
        query: {
          ...pageFilterChartParams,
          dataset: 'spans',
          yAxis: ['avg(span.duration)', 'p95(span.duration)'],
          orderby: 'avg(span.duration)',
          partial: 1,
          useRpc: 1,
          query: `span.op:http.server ${query}`.trim(),
        },
      },
    ],
    {staleTime: 0}
  );

  const getTimeSeries = useCallback(
    (field: string, color?: string): DiscoverSeries | undefined => {
      const series = data?.[field];
      if (!series) {
        return undefined;
      }

      return {
        data: series.data.map(([time, [value]]) => ({
          value: value?.count!,
          name: new Date(time * 1000).toISOString(),
        })),
        seriesName: field,
        meta: series.meta as EventsMetaType,
        color,
      } satisfies DiscoverSeries;
    },
    [data]
  );

  const timeSeries = useMemo(() => {
    return [
      getTimeSeries('avg(span.duration)', CHART_PALETTE[1][0]),
      getTimeSeries('p95(span.duration)', CHART_PALETTE[1][1]),
    ].filter(series => !!series);
  }, [getTimeSeries]);

  return (
    <InsightsLineChartWidget
      title="Duration"
      isLoading={isLoading}
      error={error}
      series={timeSeries}
    />
  );
}
