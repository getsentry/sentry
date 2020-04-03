import React from 'react';
import * as ReactRouter from 'react-router';

import {TimeSeriesData} from 'app/views/events/utils/eventsRequest';
import AreaChart from 'app/components/charts/areaChart';
import ChartZoom from 'app/components/charts/chartZoom';
import Tooltip from 'app/components/tooltip';

import {HeaderTitle, ChartContainer, StyledIconQuestion} from '../styles';

type Props = {
  yAxis: string;
  data: TimeSeriesData;
  router: ReactRouter.InjectedRouter;
  statsPeriod: string | undefined;
  utc: boolean;
  projects: number[];
  environments: string[];
  loading: boolean;
  tooltipCopy: string;
};

class Chart extends React.Component<Props> {
  render() {
    const {
      data,
      yAxis,
      router,
      statsPeriod,
      utc,
      projects,
      environments,
      loading,
      tooltipCopy,
    } = this.props;
    const {timeseriesData} = data;

    if (!timeseriesData || timeseriesData.length <= 0) {
      return null;
    }

    timeseriesData[0].seriesName = yAxis;

    const areaChartProps = {
      seriesOptions: {
        showSymbol: false,
      },
      grid: {
        left: '10px',
        right: '10px',
        top: '16px',
        bottom: '0px',
      },
      utc,
      isGroupedByDate: true,
      showTimeInTooltip: true,
    };

    if (loading) {
      return (
        <ChartContainer key="loading">
          <HeaderTitle>{yAxis}</HeaderTitle>
          <AreaChart series={[]} {...areaChartProps} />
        </ChartContainer>
      );
    }

    return (
      <ChartContainer key="loaded">
        <HeaderTitle>
          {yAxis}
          <Tooltip position="top" title={tooltipCopy}>
            <StyledIconQuestion size="sm" />
          </Tooltip>
        </HeaderTitle>
        <ChartZoom
          router={router}
          period={statsPeriod}
          utc={utc}
          projects={projects}
          environments={environments}
        >
          {zoomRenderProps => (
            <AreaChart {...zoomRenderProps} series={timeseriesData} {...areaChartProps} />
          )}
        </ChartZoom>
      </ChartContainer>
    );
  }
}

export default Chart;
