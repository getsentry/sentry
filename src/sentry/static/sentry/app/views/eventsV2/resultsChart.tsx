import React from 'react';
import styled from '@emotion/styled';
import * as ReactRouter from 'react-router';
import {Location} from 'history';
import isEqual from 'lodash/isEqual';

import {Organization} from 'app/types';
import {getUtcToLocalDateObject} from 'app/utils/dates';
import {Client} from 'app/api';
import {getParams} from 'app/components/organizations/globalSelectionHeader/getParams';
import {Panel} from 'app/components/panels';
import getDynamicText from 'app/utils/getDynamicText';
import {EventsChart} from 'app/views/events/eventsChart';
import EventView from 'app/utils/discover/eventView';
import {DisplayModes} from 'app/utils/discover/types';

import ChartFooter from './chartFooter';

type ResultsChartProps = {
  api: Client;
  router: ReactRouter.InjectedRouter;
  organization: Organization;
  eventView: EventView;
  location: Location;
};

class ResultsChart extends React.Component<ResultsChartProps> {
  shouldComponentUpdate(nextProps: ResultsChartProps) {
    const {eventView, ...restProps} = this.props;
    const {eventView: nextEventView, ...restNextProps} = nextProps;

    if (!eventView.isEqualTo(nextEventView)) {
      return true;
    }

    return !isEqual(restProps, restNextProps);
  }

  render() {
    const {api, eventView, location, organization, router} = this.props;

    const yAxisValue = eventView.getYAxis();

    const globalSelection = eventView.getGlobalSelection();
    const start = globalSelection.start
      ? getUtcToLocalDateObject(globalSelection.start)
      : undefined;

    const end = globalSelection.end
      ? getUtcToLocalDateObject(globalSelection.end)
      : undefined;

    const {utc} = getParams(location.query);

    return (
      <React.Fragment>
        {getDynamicText({
          value: (
            <EventsChart
              api={api}
              router={router}
              query={eventView.getEventsAPIPayload(location).query}
              organization={organization}
              showLegend
              yAxis={yAxisValue}
              projects={globalSelection.project}
              environments={globalSelection.environment}
              start={start}
              end={end}
              period={globalSelection.statsPeriod}
              disablePrevious={eventView.display !== DisplayModes.PREVIOUS}
              disableReleases={eventView.display !== DisplayModes.RELEASES}
              utc={utc === 'true'}
            />
          ),
          fixed: 'events chart',
        })}
      </React.Fragment>
    );
  }
}

type ContainerProps = {
  api: Client;
  router: ReactRouter.InjectedRouter;
  eventView: EventView;
  location: Location;
  organization: Organization;

  // chart footer props
  total: number | null;
  onAxisChange: (value: string) => void;
  onDisplayChange: (value: string) => void;
};

class ResultsChartContainer extends React.Component<ContainerProps> {
  shouldComponentUpdate(nextProps: ContainerProps) {
    const {eventView, ...restProps} = this.props;
    const {eventView: nextEventView, ...restNextProps} = nextProps;

    if (!eventView.isEqualTo(nextEventView)) {
      return true;
    }

    return !isEqual(restProps, restNextProps);
  }

  render() {
    const {
      api,
      eventView,
      location,
      router,
      total,
      onAxisChange,
      onDisplayChange,
      organization,
    } = this.props;

    const yAxisValue = eventView.getYAxis();

    return (
      <StyledPanel>
        <ResultsChart
          api={api}
          eventView={eventView}
          location={location}
          organization={organization}
          router={router}
        />
        <ChartFooter
          total={total}
          yAxisValue={yAxisValue}
          yAxisOptions={eventView.getYAxisOptions()}
          onAxisChange={onAxisChange}
          displayOptions={eventView.getDisplayOptions()}
          displayMode={eventView.display || DisplayModes.NONE}
          onDisplayChange={onDisplayChange}
        />
      </StyledPanel>
    );
  }
}

export default ResultsChartContainer;

export const StyledPanel = styled(Panel)`
  @media (min-width: ${p => p.theme.breakpoints[1]}) {
    margin: 0;
  }
`;
