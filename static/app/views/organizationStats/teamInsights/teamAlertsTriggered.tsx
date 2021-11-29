import styled from '@emotion/styled';

import AsyncComponent from 'sentry/components/asyncComponent';
import BarChart from 'sentry/components/charts/barChart';
import {DateTimeObject} from 'sentry/components/charts/utils';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {getParams} from 'sentry/components/organizations/globalSelectionHeader/getParams';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {Organization} from 'sentry/types';

import {
  barAxisLabel,
  convertDaySeriesToWeeks,
  convertDayValueObjectToSeries,
} from './utils';

type AlertsTriggered = Record<string, number>;

type Props = AsyncComponent['props'] & {
  organization: Organization;
  teamSlug: string;
} & DateTimeObject;

type State = AsyncComponent['state'] & {
  alertsTriggered: AlertsTriggered | null;
};

class TeamAlertsTriggered extends AsyncComponent<Props, State> {
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
        `/teams/${organization.slug}/${teamSlug}/alerts-triggered/`,
        {
          query: {
            ...getParams(datetime),
          },
        },
      ],
    ];
  }

  componentDidUpdate(prevProps: Props) {
    const {start, end, period, utc, teamSlug} = this.props;

    if (
      prevProps.start !== start ||
      prevProps.end !== end ||
      prevProps.period !== period ||
      prevProps.utc !== utc ||
      prevProps.teamSlug !== teamSlug
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
    const {alertsTriggered} = this.state;
    const data = convertDayValueObjectToSeries(alertsTriggered ?? {});
    const seriesData = convertDaySeriesToWeeks(data);

    return (
      <ChartWrapper>
        {alertsTriggered && (
          <BarChart
            style={{height: 190}}
            isGroupedByDate
            useShortDate
            period="7d"
            legend={{right: 0, top: 0}}
            yAxis={{minInterval: 1}}
            xAxis={barAxisLabel(seriesData.length)}
            series={[
              {
                seriesName: t('Alerts Triggered'),
                data: seriesData,
                silent: true,
              },
            ]}
          />
        )}
      </ChartWrapper>
    );
  }
}

export default TeamAlertsTriggered;

const ChartWrapper = styled('div')`
  padding: ${space(2)} ${space(2)} 0 ${space(2)};
`;
