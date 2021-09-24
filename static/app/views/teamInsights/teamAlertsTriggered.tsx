import styled from '@emotion/styled';
import random from 'lodash/random';
import moment from 'moment';

import AsyncComponent from 'app/components/asyncComponent';
import BarChart from 'app/components/charts/barChart';
import {DateTimeObject} from 'app/components/charts/utils';
import LoadingIndicator from 'app/components/loadingIndicator';
import {getParams} from 'app/components/organizations/globalSelectionHeader/getParams';
import {t} from 'app/locale';
import space from 'app/styles/space';
import {Organization} from 'app/types';
import {getDuration} from 'app/utils/formatters';

type Props = AsyncComponent['props'] & {
  organization: Organization;
  teamSlug: string;
} & DateTimeObject;

type State = AsyncComponent['state'] & {
  alertsTriggered: any | null;
};

class TeamIssues extends AsyncComponent<Props, State> {
  shouldRenderBadRequests = true;

  getDefaultState(): State {
    return {
      ...super.getDefaultState(),
      alertsTriggered: null,
    };
  }

  getEndpoints(): ReturnType<AsyncComponent['getEndpoints']> {
    const {organization, start, end, period, utc, teamSlug} = this.props;
    const datetime = {start, end, period, utc};
    return [
      [
        'alertsTriggered',
        `/organizations/${organization.slug}/${teamSlug}/alerts-triggered/`,
        {
          query: {
            ...getParams(datetime),
          },
        },
      ],
    ];
  }

  renderLoading() {
    return this.renderBody();
  }

  renderBody() {
    const {isLoading} = this.state;

    return (
      <ChartWrapper>
        {isLoading && <LoadingIndicator />}
        {!isLoading && (
          <BarChart
            style={{height: 200}}
            isGroupedByDate
            legend={{right: 0, top: 0}}
            tooltip={{
              valueFormatter: (value: number) => {
                return getDuration(value, 1);
              },
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
            series={[
              {
                seriesName: t('Manually Resolved'),
                data: Array(12)
                  .fill(0)
                  .map((_, i) => {
                    return {
                      value: random(86400, 86400 * 10, true),
                      name: moment().startOf('day').subtract(i, 'd').toISOString(),
                    };
                  }),
              },
            ].reverse()}
          />
        )}
      </ChartWrapper>
    );
  }
}

export default TeamIssues;

const ChartWrapper = styled('div')`
  padding: ${space(2)} ${space(2)} 0 ${space(2)};
`;
