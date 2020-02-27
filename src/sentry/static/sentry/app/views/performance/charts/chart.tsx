import React from 'react';
import styled from '@emotion/styled';
import * as ReactRouter from 'react-router';

import {TimeSeriesData} from 'app/views/events/utils/eventsRequest';
import AreaChart from 'app/components/charts/areaChart';
import ChartZoom from 'app/components/charts/chartZoom';

import {HeaderTitle} from './styles';

type Props = {
  yAxis: string;
  data: TimeSeriesData;
  router: ReactRouter.InjectedRouter;
  statsPeriod: string | undefined;
  utc: boolean;
  projects: number[];
  environments: string[];
  loading: boolean;
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
        left: '24px',
        right: '48px',
        top: '24px',
        bottom: '12px',
      },
      utc,
      isGroupedByDate: true,
      showTimeInTooltip: true,
    };

    if (loading) {
      return (
        <Container key="loading">
          <HeaderTitle>{yAxis}</HeaderTitle>
          <AreaChart series={[]} {...areaChartProps} />
        </Container>
      );
    }

    return (
      <Container key="loaded">
        <HeaderTitle>{yAxis}</HeaderTitle>
        <ChartZoom
          router={router}
          period={statsPeriod}
          utc={utc}
          projects={projects}
          environments={environments}
        >
          {zoomRenderProps => {
            return (
              <AreaChart
                {...zoomRenderProps}
                series={timeseriesData}
                {...areaChartProps}
              />
            );
          }}
        </ChartZoom>
      </Container>
    );
  }
}

const Container = styled('div')`
  min-width: 50%;
  max-width: 50%;
  width: 50%;
`;

export default Chart;
