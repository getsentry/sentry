import styled from '@emotion/styled';

import AsyncComponent from 'app/components/asyncComponent';
import BarChart from 'app/components/charts/barChart';
import {DateTimeObject} from 'app/components/charts/utils';
import LoadingIndicator from 'app/components/loadingIndicator';
import {getParams} from 'app/components/organizations/globalSelectionHeader/getParams';
import {t} from 'app/locale';
import space from 'app/styles/space';
import {Organization} from 'app/types';
import {getDuration} from 'app/utils/formatters';

import {convertDaySeriesToWeeks} from './utils';

type TimeToResolution = Record<string, {count: number; avg: number}>;

type Props = AsyncComponent['props'] & {
  organization: Organization;
  teamSlug: string;
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
    const {organization, start, end, period, utc, teamSlug} = this.props;
    const datetime = {start, end, period, utc};

    return [
      [
        'resolutionTime',
        `/teams/${organization.slug}/${teamSlug}/time-to-resolution/`,
        {
          query: {
            ...getParams(datetime),
          },
        },
      ],
    ];
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
    const seriesData = convertDaySeriesToWeeks(data);

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
          xAxis={{
            type: 'time',
          }}
          series={[
            {
              seriesName: t('Time to Resolution'),
              data: seriesData,
              silent: true,
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
