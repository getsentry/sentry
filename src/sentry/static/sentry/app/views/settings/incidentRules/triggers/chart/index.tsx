import React from 'react';
import maxBy from 'lodash/maxBy';
import styled from '@emotion/styled';

import {Client} from 'app/api';
import {Organization, Project} from 'app/types';
import {SeriesDataUnit} from 'app/types/echarts';
import EventsRequest from 'app/views/events/utils/eventsRequest';
import LoadingMask from 'app/components/loadingMask';
import Placeholder from 'app/components/placeholder';
import space from 'app/styles/space';

import {IncidentRule, TimeWindow, Trigger} from '../../types';
import ThresholdsChart from './thresholdsChart';

type Props = {
  api: Client;
  organization: Organization;
  projects: Project[];

  query: IncidentRule['query'];
  timeWindow: IncidentRule['timeWindow'];
  environment: string | null;
  aggregate: IncidentRule['aggregate'];
  triggers: Trigger[];
};

/**
 * This is a chart to be used in Metric Alert rules that fetches events based on
 * query, timewindow, and aggregations.
 */
class TriggersChart extends React.PureComponent<Props> {
  render() {
    const {
      api,
      organization,
      projects,
      timeWindow,
      query,
      aggregate,
      triggers,
      environment,
    } = this.props;

    const period = getPeriodForTimeWindow(timeWindow);

    return (
      <EventsRequest
        api={api}
        organization={organization}
        query={query}
        environment={environment ? [environment] : undefined}
        project={projects.map(({id}) => Number(id))}
        interval={`${timeWindow}m`}
        period={period}
        yAxis={aggregate}
        includePrevious={false}
        currentSeriesName={aggregate}
      >
        {({loading, reloading, timeseriesData}) => {
          let maxValue: SeriesDataUnit | undefined;
          if (timeseriesData && timeseriesData.length && timeseriesData[0].data) {
            maxValue = maxBy(timeseriesData[0].data, ({value}) => value);
          }

          return (
            <StickyWrapper>
              {loading ? (
                <ChartPlaceholder />
              ) : (
                <React.Fragment>
                  <TransparentLoadingMask visible={reloading} />
                  <ThresholdsChart
                    period={period}
                    maxValue={maxValue ? maxValue.value : maxValue}
                    data={timeseriesData}
                    triggers={triggers}
                  />
                </React.Fragment>
              )}
            </StickyWrapper>
          );
        }}
      </EventsRequest>
    );
  }
}

export default TriggersChart;

const TIME_WINDOW_TO_PERIOD: Record<TimeWindow, string> = {
  [TimeWindow.ONE_MINUTE]: '12h',
  [TimeWindow.FIVE_MINUTES]: '12h',
  [TimeWindow.TEN_MINUTES]: '1d',
  [TimeWindow.FIFTEEN_MINUTES]: '3d',
  [TimeWindow.THIRTY_MINUTES]: '3d',
  [TimeWindow.ONE_HOUR]: '7d',
  [TimeWindow.TWO_HOURS]: '7d',
  [TimeWindow.FOUR_HOURS]: '7d',
  [TimeWindow.ONE_DAY]: '14d',
};

/**
 * Gets a reasonable period given a time window (in minutes)
 *
 * @param timeWindow The time window in minutes
 * @return period The period string to use (e.g. 14d)
 */
function getPeriodForTimeWindow(timeWindow: TimeWindow): string {
  return TIME_WINDOW_TO_PERIOD[timeWindow];
}

const TransparentLoadingMask = styled(LoadingMask)<{visible: boolean}>`
  ${p => !p.visible && 'display: none;'};
  opacity: 0.4;
  z-index: 1;
`;

const ChartPlaceholder = styled(Placeholder)`
  margin: ${space(2)} 0;
  height: 184px;
`;

const StickyWrapper = styled('div')`
  position: sticky;
  top: 69px; /* Height of settings breadcrumb 69px */
  z-index: ${p => p.theme.zIndex.dropdown - 1};
  padding: ${space(2)} ${space(2)} 0;
  border-bottom: 1px solid ${p => p.theme.borderLight};
  background: rgba(255, 255, 255, 0.9);
`;
