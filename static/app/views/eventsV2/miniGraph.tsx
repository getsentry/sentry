import * as React from 'react';
import {withTheme} from '@emotion/react';
import styled from '@emotion/styled';
import {Location} from 'history';
import isEqual from 'lodash/isEqual';

import {Client} from 'app/api';
import AreaChart from 'app/components/charts/areaChart';
import BarChart from 'app/components/charts/barChart';
import EventsGeoRequest from 'app/components/charts/eventsGeoRequest';
import EventsRequest from 'app/components/charts/eventsRequest';
import LineChart from 'app/components/charts/lineChart';
import {getInterval, processTableResults} from 'app/components/charts/utils';
import WorldMapChart from 'app/components/charts/worldMapChart';
import LoadingContainer from 'app/components/loading/loadingContainer';
import LoadingIndicator from 'app/components/loadingIndicator';
import {IconWarning} from 'app/icons';
import {Organization} from 'app/types';
import {Series} from 'app/types/echarts';
import {getUtcToLocalDateObject} from 'app/utils/dates';
import {axisLabelFormatter} from 'app/utils/discover/charts';
import EventView from 'app/utils/discover/eventView';
import {PlotType} from 'app/utils/discover/fields';
import {DisplayModes, TOP_N} from 'app/utils/discover/types';
import {decodeScalar} from 'app/utils/queryString';
import {Theme} from 'app/utils/theme';
import withApi from 'app/utils/withApi';

type Props = {
  theme: Theme;
  organization: Organization;
  eventView: EventView;
  api: Client;
  location: Location;
  referrer?: string;
  yAxis?: string[];
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

    const {organization, location, eventView, yAxis} = props;

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
    const intervalFidelity = display === 'bar' ? 'low' : 'high';
    const interval = isDaily ? '1d' : getInterval({start, end, period}, intervalFidelity);

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
      yAxis: yAxis ?? eventView.getYAxis(),
      field,
      topEvents,
      orderby,
      showDaily: isDaily,
      expired: eventView.expired,
      name: eventView.name,
      display,
    };
  }

  getChartType({
    showDaily,
  }: {
    showDaily: boolean;
    yAxis: string;
    timeseriesData: Series[];
  }): PlotType {
    if (showDaily) {
      return 'bar';
    }
    return 'area';
  }

  getChartComponent(
    chartType: PlotType
  ): React.ComponentType<BarChart['props']> | React.ComponentType<AreaChart['props']> {
    switch (chartType) {
      case 'bar':
        return BarChart;
      case 'line':
        return LineChart;
      case 'area':
        return AreaChart;
      default:
        throw new Error(`Unknown multi plot type for ${chartType}`);
    }
  }

  render() {
    const {theme, api, referrer} = this.props;
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
      expired,
      name,
      display,
    } = this.getRefreshProps(this.props);

    if (display === DisplayModes.WORLDMAP) {
      return (
        <EventsGeoRequest
          api={api}
          organization={organization}
          yAxis={yAxis}
          query={query}
          orderby={orderby}
          projects={project as number[]}
          period={period}
          start={start}
          end={end}
          environments={environment as string[]}
          referrer={referrer}
        >
          {({errored, loading, tableData}) => {
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
            const {data, title} = processTableResults(tableData);
            const chartOptions = {
              height: 100,
              series: [
                {
                  seriesName: title,
                  data,
                },
              ],
              fromDiscoverQueryList: true,
            };

            return <WorldMapChart {...chartOptions} />;
          }}
        </EventsGeoRequest>
      );
    }
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
        expired={expired}
        name={name}
        referrer={referrer}
        hideError
        partial
      >
        {({loading, timeseriesData, results, errored, errorMessage}) => {
          if (errored) {
            return (
              <StyledGraphContainer>
                <IconWarning color="gray300" size="md" />
                <StyledErrorMessage>{errorMessage}</StyledErrorMessage>
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
          const chartType =
            display === 'bar'
              ? display
              : this.getChartType({
                  showDaily,
                  yAxis: Array.isArray(yAxis) ? yAxis[0] : yAxis,
                  timeseriesData: allSeries,
                });
          const data = allSeries.map(series => ({
            ...series,
            lineStyle: {
              opacity: chartType === 'line' ? 1 : 0,
            },
            smooth: true,
          }));

          const hasOther = topEvents && topEvents + 1 === allSeries.length;
          const chartColors = allSeries.length
            ? [...theme.charts.getColorPalette(allSeries.length - 2 - (hasOther ? 1 : 0))]
            : undefined;
          if (chartColors && chartColors.length && hasOther) {
            chartColors.push(theme.chartOther);
          }
          const chartOptions = {
            colors: chartColors,
            height: 150,
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
                formatter: (value: number) =>
                  axisLabelFormatter(
                    value,
                    Array.isArray(yAxis) ? yAxis[0] : yAxis,
                    true
                  ),
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
            stacked:
              (typeof topEvents === 'number' && topEvents > 0) ||
              (Array.isArray(yAxis) && yAxis.length > 1),
          };

          const Component = this.getChartComponent(chartType);
          return <Component {...chartOptions} />;
        }}
      </EventsRequest>
    );
  }
}

const StyledGraphContainer = styled(props => (
  <LoadingContainer {...props} maskBackgroundColor="transparent" />
))`
  height: 150px;

  display: flex;
  justify-content: center;
  align-items: center;
`;

const StyledErrorMessage = styled('div')`
  color: ${p => p.theme.gray300};
  margin-left: 4px;
`;

export default withApi(withTheme(MiniGraph));
