import React from 'react';
import isEqual from 'lodash/isEqual';
import {Location} from 'history';
import styled from '@emotion/styled';

import withApi from 'app/utils/withApi';
import {Client} from 'app/api';
import {Organization} from 'app/types';
import EventsRequest from 'app/components/charts/eventsRequest';
import AreaChart from 'app/components/charts/areaChart';
import {getInterval} from 'app/components/charts/utils';
import {getUtcToLocalDateObject} from 'app/utils/dates';
import {axisLabelFormatter} from 'app/utils/discover/charts';
import LoadingIndicator from 'app/components/loadingIndicator';
import LoadingContainer from 'app/components/loading/loadingContainer';
import {IconWarning} from 'app/icons';
import theme from 'app/utils/theme';
import EventView from 'app/utils/discover/eventView';

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
    const start = apiPayload.start ? getUtcToLocalDateObject(apiPayload.start) : null;
    const end = apiPayload.end ? getUtcToLocalDateObject(apiPayload.end) : null;
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
      yAxis: eventView.getYAxis(),
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
      yAxis,
    } = this.getRefreshProps(this.props);
    const colors = theme.charts.getColorPalette(1);

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
        yAxis={yAxis}
      >
        {({loading, timeseriesData, errored}) => {
          if (errored) {
            return (
              <StyledGraphContainer>
                <IconWarning color="gray500" size="md" />
              </StyledGraphContainer>
            );
          }
          if (loading) {
            return (
              <StyledGraphContainer>
                <LoadingIndicator mini />
              </StyledGraphContainer>
            );
          }

          const data = (timeseriesData || []).map(series => ({
            ...series,
            areaStyle: {
              color: colors[0],
              opacity: 1,
            },
            lineStyle: {
              opacity: 0,
            },
            smooth: true,
          }));

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
                show: true,
                axisLine: {
                  show: false,
                },
                axisLabel: {
                  color: theme.gray400,
                  fontFamily: theme.text.family,
                  fontSize: 12,
                  formatter: (value: number) => axisLabelFormatter(value, yAxis, true),
                  inside: true,
                  showMinLabel: false,
                  showMaxLabel: false,
                },
                splitNumber: 3,
                splitLine: {
                  show: false,
                },
                zlevel: theme.zIndex.header,
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
            />
          );
        }}
      </EventsRequest>
    );
  }
}

const StyledGraphContainer = styled(props => (
  <LoadingContainer {...props} maskBackgroundColor="transparent" />
))`
  height: 100px;

  display: flex;
  justify-content: center;
  align-items: center;
`;

export default withApi(MiniGraph);
