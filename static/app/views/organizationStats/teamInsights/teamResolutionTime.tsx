import styled from '@emotion/styled';

import AsyncComponent from 'sentry/components/asyncComponent';
import BarChart from 'sentry/components/charts/barChart';
import {DateTimeObject} from 'sentry/components/charts/utils';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {normalizeDateTimeParams} from 'sentry/components/organizations/pageFilters/parse';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {Organization} from 'sentry/types';
import {getDuration} from 'sentry/utils/formatters';

import {barAxisLabel, sortSeriesByDay} from './utils';

type TimeToResolution = Record<string, {avg: number; count: number}>;

type Props = AsyncComponent['props'] & {
  organization: Organization;
  teamSlug: string;
  environment?: string;
} & DateTimeObject;

type State = AsyncComponent['state'] & {
  resolutionTime: TimeToResolution | null;
};

class TeamResolutionTime extends AsyncComponent<Props, State> {
  shouldRenderBadRequests = true;

  getDefaultState(): State {
    return {
      ...super.getDefaultState(),
      resolutionTime: null,
    };
  }

  getEndpoints(): ReturnType<AsyncComponent['getEndpoints']> {
    const {organization, start, end, period, utc, teamSlug, environment} = this.props;
    const datetime = {start, end, period, utc};

    return [
      [
        'resolutionTime',
        `/teams/${organization.slug}/${teamSlug}/time-to-resolution/`,
        {
          query: {
            ...normalizeDateTimeParams(datetime),
            environment,
          },
        },
      ],
    ];
  }

  componentDidUpdate(prevProps: Props) {
    const {start, end, period, utc, teamSlug, environment} = this.props;

    if (
      prevProps.start !== start ||
      prevProps.end !== end ||
      prevProps.period !== period ||
      prevProps.utc !== utc ||
      prevProps.teamSlug !== teamSlug ||
      prevProps.environment !== environment
    ) {
      this.remountComponent();
    }
  }

  renderLoading() {
    return (
      <ChartWrapper>
        <LoadingIndicator />
      </ChartWrapper>
    );
  }

  renderBody() {
    const {resolutionTime} = this.state;
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
          xAxis={barAxisLabel(seriesData.length)}
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
}

export default TeamResolutionTime;

const ChartWrapper = styled('div')`
  padding: ${space(2)} ${space(2)} 0 ${space(2)};
`;
