import styled from '@emotion/styled';

import {BarChart} from 'sentry/components/charts/barChart';
import {DateTimeObject} from 'sentry/components/charts/utils';
import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {normalizeDateTimeParams} from 'sentry/components/organizations/pageFilters/parse';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {Organization} from 'sentry/types';
import {getDuration} from 'sentry/utils/formatters';
import {useApiQuery} from 'sentry/utils/queryClient';

import {barAxisLabel, sortSeriesByDay} from './utils';

export type TimeToResolution = Record<string, {avg: number; count: number}>;

interface TeamResolutionTimeProps extends DateTimeObject {
  organization: Organization;
  teamSlug: string;
  environment?: string;
}

function TeamResolutionTime({
  organization,
  teamSlug,
  environment,
  start,
  end,
  period,
  utc,
}: TeamResolutionTimeProps) {
  const datetime = {start, end, period, utc};

  const {
    data: resolutionTime,
    isLoading,
    isError,
    refetch,
  } = useApiQuery<TimeToResolution>(
    [
      `/teams/${organization.slug}/${teamSlug}/time-to-resolution/`,
      {
        query: {
          ...normalizeDateTimeParams(datetime),
          environment,
        },
      },
    ],
    {staleTime: 5000}
  );

  if (isLoading) {
    return (
      <ChartWrapper>
        <LoadingIndicator />
      </ChartWrapper>
    );
  }

  if (isError) {
    return <LoadingError onRetry={refetch} />;
  }

  const data = Object.entries(resolutionTime ?? {}).map(([bucket, {avg}]) => ({
    value: avg,
    name: new Date(bucket).getTime(),
  }));

  const seriesData = sortSeriesByDay(data);

  return (
    <ChartWrapper>
      <BarChart
        style={{height: 190}}
        isGroupedByDate
        useShortDate
        period="7d"
        tooltip={{
          valueFormatter: (value: number) => getDuration(value, 1),
        }}
        yAxis={{
          // Each yAxis marker will increase by 1 day
          minInterval: 86400,
          axisLabel: {
            formatter: (value: number) => {
              if (value === 0) {
                return '';
              }

              return getDuration(value, 0, true, true);
            },
          },
        }}
        legend={{right: 0, top: 0}}
        xAxis={barAxisLabel()}
        series={[
          {
            seriesName: t('Time to Resolution'),
            data: seriesData,
            silent: true,
            barCategoryGap: '5%',
          },
        ]}
      />
    </ChartWrapper>
  );
}

export default TeamResolutionTime;

const ChartWrapper = styled('div')`
  padding: ${space(2)} ${space(2)} 0 ${space(2)};
`;
