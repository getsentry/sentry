import {useMemo} from 'react';
import {useTheme} from '@emotion/react';

import type {MultiSeriesEventsStats} from 'sentry/types/organization';
import {parsePeriodToHours} from 'sentry/utils/duration/parsePeriodToHours';
import {useApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';
import {InsightsBarChartWidget} from 'sentry/views/insights/common/components/insightsBarChartWidget';
import type {DiscoverSeries} from 'sentry/views/insights/common/queries/useDiscoverSeries';
import {usePageFilterChartParams} from 'sentry/views/insights/pages/backend/laravel/utils';

export function JobsWidget({query}: {query?: string}) {
  const organization = useOrganization();
  const pageFilterChartParams = usePageFilterChartParams({
    granularity: 'low',
  });
  const theme = useTheme();

  const {data, isLoading, error} = useApiQuery<MultiSeriesEventsStats>(
    [
      `/organizations/${organization.slug}/events-stats/`,
      {
        query: {
          ...pageFilterChartParams,
          dataset: 'spansMetrics',
          excludeOther: 0,
          per_page: 50,
          partial: 1,
          transformAliasToInputFormat: 1,
          query: `span.op:queue.process ${query}`.trim(),
          yAxis: ['trace_status_rate(ok)', 'spm()'],
        },
      },
    ],
    {staleTime: 0}
  );

  const intervalInMinutes = parsePeriodToHours(pageFilterChartParams.interval) * 60;

  const timeSeries = useMemo<DiscoverSeries[]>(() => {
    if (!data) {
      return [];
    }

    const okJobsRate = data['trace_status_rate(ok)'];
    const spansPerMinute = data['spm()'];

    if (!okJobsRate || !spansPerMinute) {
      return [];
    }

    const getSpansInTimeBucket = (index: number) => {
      const spansPerMinuteValue = spansPerMinute.data[index]?.[1][0]?.count! || 0;
      return spansPerMinuteValue * intervalInMinutes;
    };

    const [okJobs, failedJobs] = okJobsRate.data.reduce<[DiscoverSeries, DiscoverSeries]>(
      (acc, [time, [value]], index) => {
        const spansInTimeBucket = getSpansInTimeBucket(index);
        const okJobsRateValue = value?.count! || 0;
        const failedJobsRateValue = value?.count ? 1 - value.count : 1;

        acc[0].data.push({
          value: okJobsRateValue * spansInTimeBucket,
          name: new Date(time * 1000).toISOString(),
        });

        acc[1].data.push({
          value: failedJobsRateValue * spansInTimeBucket,
          name: new Date(time * 1000).toISOString(),
        });

        return acc;
      },
      [
        {
          data: [],
          color: theme.gray200,
          seriesName: 'Processed',
          meta: {
            fields: {
              Processed: 'integer',
            },
            units: {},
          },
        },
        {
          data: [],
          color: theme.error,
          seriesName: 'Failed',
          meta: {
            fields: {
              Failed: 'integer',
            },
            units: {},
          },
        },
      ]
    );

    return [okJobs, failedJobs];
  }, [data, intervalInMinutes, theme.error, theme.gray200]);

  return (
    <InsightsBarChartWidget
      title="Jobs"
      stacked
      isLoading={isLoading}
      error={error}
      series={timeSeries}
    />
  );
}
