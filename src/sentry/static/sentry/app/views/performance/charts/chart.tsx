import React from 'react';
import * as ReactRouter from 'react-router';

import {Series} from 'app/types/echarts';
import AreaChart from 'app/components/charts/areaChart';
import ChartZoom from 'app/components/charts/chartZoom';
import Tooltip from 'app/components/tooltip';

import {HeaderTitle, ChartContainer, StyledIconQuestion} from '../styles';

type Props = {
  yAxis: string;
  data: Series;
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

    if (!data || data.data.length <= 0) {
      return null;
    }

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
            <AreaChart {...zoomRenderProps} series={[data]} {...areaChartProps} />
          )}
        </ChartZoom>
      </ChartContainer>
    );
  }
}

export default Chart;
