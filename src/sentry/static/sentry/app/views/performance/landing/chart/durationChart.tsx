import React from 'react';
import * as ReactRouter from 'react-router';
import withRouter, {WithRouterProps} from 'react-router/lib/withRouter';
import styled from '@emotion/styled';
import {Location} from 'history';

import {Client} from 'app/api';
import ErrorPanel from 'app/components/charts/errorPanel';
import EventsRequest from 'app/components/charts/eventsRequest';
import LoadingPanel from 'app/components/charts/loadingPanel';
import {getInterval} from 'app/components/charts/utils';
import {getParams} from 'app/components/organizations/globalSelectionHeader/getParams';
import QuestionTooltip from 'app/components/questionTooltip';
import {IconWarning} from 'app/icons';
import space from 'app/styles/space';
import {Organization} from 'app/types';
import {getUtcToLocalDateObject} from 'app/utils/dates';
import EventView from 'app/utils/discover/eventView';
import withApi from 'app/utils/withApi';

import Chart from '../../charts/chart';
import {DoubleHeaderContainer, HeaderTitleLegend} from '../../styles';

type Props = {
  api: Client;
  eventView: EventView;
  organization: Organization;
  location: Location;
  router: ReactRouter.InjectedRouter;
  field: string;
  title: string;
  titleTooltip: string;
} & WithRouterProps;

function DurationChart(props: Props) {
  const {
    organization,
    api,
    eventView,
    location,
    router,
    field,
    title,
    titleTooltip,
  } = props;

  // construct request parameters for fetching chart data
  const globalSelection = eventView.getGlobalSelection();
  const start = globalSelection.datetime.start
    ? getUtcToLocalDateObject(globalSelection.datetime.start)
    : undefined;

  const end = globalSelection.datetime.end
    ? getUtcToLocalDateObject(globalSelection.datetime.end)
    : undefined;

  const {utc} = getParams(location.query);

  return (
    <EventsRequest
      organization={organization}
      api={api}
      period={globalSelection.datetime.period}
      project={globalSelection.projects}
      environment={globalSelection.environments}
      start={start}
      end={end}
      interval={getInterval(
        {
          start: start || null,
          end: end || null,
          period: globalSelection.datetime.period,
        },
        true
      )}
      showLoading={false}
      query={eventView.getEventsAPIPayload(location).query}
      includePrevious={false}
      yAxis={[field]}
    >
      {({loading, reloading, errored, timeseriesData}) => {
        const results = timeseriesData;
        if (errored) {
          return (
            <ErrorPanel>
              <IconWarning color="gray300" size="lg" />
            </ErrorPanel>
          );
        }

        return (
          <DurationChartContainer>
            <DoubleHeaderContainer>
              <HeaderTitleLegend>
                {title}
                <QuestionTooltip position="top" size="sm" title={titleTooltip} />
              </HeaderTitleLegend>
            </DoubleHeaderContainer>
            {results ? (
              <ChartContainer>
                <Chart
                  height={250}
                  data={results}
                  loading={loading || reloading}
                  router={router}
                  statsPeriod={globalSelection.datetime.period}
                  utc={utc === 'true'}
                  grid={{
                    left: space(3),
                    right: space(3),
                    top: space(3),
                    bottom: space(1.5),
                  }}
                  disableMultiAxis
                />
              </ChartContainer>
            ) : (
              <LoadingPanel data-test-id="events-request-loading" />
            )}
          </DurationChartContainer>
        );
      }}
    </EventsRequest>
  );
}

const DurationChartContainer = styled('div')``;

const ChartContainer = styled('div')`
  padding-top: ${space(1)};
`;

export default withRouter(withApi(DurationChart));
