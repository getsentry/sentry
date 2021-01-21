import React from 'react';
import styled from '@emotion/styled';
import {Location} from 'history';
import isEqual from 'lodash/isEqual';

import {Client} from 'app/api';
import AreaChart from 'app/components/charts/areaChart';
import BarChart from 'app/components/charts/barChart';
import EventsRequest from 'app/components/charts/eventsRequest';
import {getInterval} from 'app/components/charts/utils';
import LoadingContainer from 'app/components/loading/loadingContainer';
import LoadingIndicator from 'app/components/loadingIndicator';
import {IconWarning} from 'app/icons';
import {Organization} from 'app/types';
import {getUtcToLocalDateObject} from 'app/utils/dates';
import {axisLabelFormatter} from 'app/utils/discover/charts';
import EventView from 'app/utils/discover/eventView';
import {DisplayModes, TOP_N} from 'app/utils/discover/types';
import {decodeScalar} from 'app/utils/queryString';
import theme from 'app/utils/theme';
import withApi from 'app/utils/withApi';

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

    const display = eventView.getDisplayMode();
    const isTopEvents =
      display === DisplayModes.TOP5 || display === DisplayModes.DAILYTOP5;
    const isDaily = display === DisplayModes.DAILYTOP5 || display === DisplayModes.DAILY;

    const field = isTopEvents ? apiPayload.field : undefined;
    const topEvents = isTopEvents ? TOP_N : undefined;
    const orderby = isTopEvents ? decodeScalar(apiPayload.sort) : undefined;
    const interval = isDaily ? '1d' : getInterval({start, end, period}, true);

    return {
      organization,
      apiPayload,
      query,
      start,
      end,
      period,
      interval,
      project: eventView.project,
      environment: eventView.environment,
      yAxis: eventView.getYAxis(),
      field,
      topEvents,
      orderby,
      showDaily: isDaily,
    };
  }

  getChartComponent(
    showDaily: boolean
  ): React.ComponentType<BarChart['props']> | React.ComponentType<AreaChart['props']> {
    if (showDaily) {
      return BarChart;
    }
    return AreaChart;
  }

  render() {
    const {api} = this.props;
    const {
      query,
      start,
      end,
      period,
      interval,
      organization,
      project,
      environment,
      yAxis,
      field,
      topEvents,
      orderby,
      showDaily,
    } = this.getRefreshProps(this.props);

    return (
      <EventsRequest
        organization={organization}
        api={api}
        query={query}
        start={start}
        end={end}
        period={period}
        interval={interval}
        project={project as number[]}
        environment={environment as string[]}
        includePrevious={false}
        yAxis={yAxis}
        field={field}
        topEvents={topEvents}
        orderby={orderby}
      >
        {({loading, timeseriesData, results, errored}) => {
          if (errored) {
            return (
              <StyledGraphContainer>
                <IconWarning color="gray300" size="md" />
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

          const allSeries = timeseriesData ?? results ?? [];
          const data = allSeries.map(series => ({
            ...series,
            lineStyle: {
              opacity: 0,
            },
            smooth: true,
          }));

          const chartOptions = {
            colors: [...theme.charts.getColorPalette(allSeries.length - 2)],
            height: 100,
            series: [...data],
            xAxis: {
              show: false,
              axisPointer: {
                show: false,
              },
            },
            yAxis: {
              show: true,
              axisLine: {
                show: false,
              },
              axisLabel: {
                color: theme.chartLabel,
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
            },
            tooltip: {
              show: false,
            },
            toolBox: {
              show: false,
            },
            grid: {
              left: 0,
              top: 0,
              right: 0,
              bottom: 0,
              containLabel: false,
            },
            stacked: typeof topEvents === 'number' && topEvents > 0,
          };

          const Component = this.getChartComponent(showDaily);
          return <Component {...chartOptions} />;
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
