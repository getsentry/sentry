import React from 'react';
import isEqual from 'lodash/isEqual';
import {Location} from 'history';
import styled from 'react-emotion';

import withApi from 'app/utils/withApi';
import {Client} from 'app/api';
import {Organization} from 'app/types';
import EventsRequest from 'app/views/events/utils/eventsRequest';
import AreaChart from 'app/components/charts/areaChart';
import {getInterval} from 'app/components/charts/utils';
import {getUtcToLocalDateObject} from 'app/utils/dates';
import LoadingIndicator from 'app/components/loadingIndicator';
import LoadingContainer from 'app/components/loading/loadingContainer';

import EventView from './eventView';

type Props = {
  organization: Organization;
  eventView: EventView;
  api: Client;
  location: Location;
};

class MiniGraph extends React.Component<Props> {
  shouldComponentUpdate(nextProps) {
    // We pay for the cost of the deep comparison here since it is cheaper
    // than the cost for rendering the graph, which can take ~200ms to ~300ms to
    // render.

    return !isEqual(this.getRefreshProps(this.props), this.getRefreshProps(nextProps));
  }

  getRefreshProps(props: Props) {
    // get props that are relevant to the API payload for the graph

    const {organization, location, eventView} = props;

    const apiPayload = eventView.getEventsAPIPayload(location);

    const query = apiPayload.query;
    const start = apiPayload.start
      ? getUtcToLocalDateObject(apiPayload.start)
      : undefined;
    const end = apiPayload.end ? getUtcToLocalDateObject(apiPayload.end) : undefined;
    const period: string | undefined = apiPayload.statsPeriod as any;

    return {
      organization,
      apiPayload,
      query,
      start,
      end,
      period,
      project: eventView.project,
      environment: eventView.environment,
    };
  }

  render() {
    const {api} = this.props;
    const {
      query,
      start,
      end,
      period,
      organization,
      project,
      environment,
    } = this.getRefreshProps(this.props);

    return (
      <EventsRequest
        organization={organization}
        api={api}
        query={query}
        start={start}
        end={end}
        period={period}
        interval={getInterval({start, end, period}, true)}
        project={project as number[]}
        environment={environment as string[]}
        includePrevious={false}
      >
        {({loading, timeseriesData}) => {
          if (loading) {
            return (
              <StyledLoadingContainer>
                <LoadingIndicator mini />
              </StyledLoadingContainer>
            );
          }

          const data = (timeseriesData || []).map(series => {
            return {
              ...series,
              areaStyle: {
                opacity: 0.4,
              },
              lineStyle: {
                opacity: 0,
              },
              smooth: true,
            };
          });

          return (
            <AreaChart
              height={100}
              series={[...data]}
              xAxis={{
                show: false,
                axisPointer: {
                  show: false,
                },
              }}
              yAxis={{
                show: false,
              }}
              tooltip={{
                show: false,
              }}
              toolBox={{
                show: false,
              }}
              grid={{
                left: 0,
                top: 0,
                right: 0,
                bottom: 0,
                containLabel: false,
              }}
              colors={['#6d5fc7']}
              options={{
                hoverAnimation: false,
              }}
            />
          );
        }}
      </EventsRequest>
    );
  }
}

const StyledLoadingContainer = styled(props => {
  return <LoadingContainer {...props} maskBackgroundColor="transparent" />;
})`
  height: 100px;

  display: flex;
  justify-content: center;
  align-items: center;
`;

export default withApi(MiniGraph);
