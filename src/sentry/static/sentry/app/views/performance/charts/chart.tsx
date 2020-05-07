import React from 'react';
import * as ReactRouter from 'react-router';

import {Series} from 'app/types/echarts';
import AreaChart from 'app/components/charts/areaChart';
import ChartZoom from 'app/components/charts/chartZoom';
import theme from 'app/utils/theme';

type Props = {
  data: Series[];
  router: ReactRouter.InjectedRouter;
  statsPeriod: string | undefined;
  utc: boolean;
  projects: number[];
  environments: string[];
  loading: boolean;
};

class Chart extends React.Component<Props> {
  render() {
    const {data, router, statsPeriod, utc, projects, environments, loading} = this.props;

    if (!data || data.length <= 0) {
      return null;
    }
    const colors = theme.charts.getColorPalette(1);

    const areaChartProps = {
      seriesOptions: {
        showSymbol: false,
      },
      grid: [
        {
          top: '8px',
          left: '24px',
          right: '52%',
          bottom: '16px',
        },
        {
          top: '8px',
          left: '52%',
          right: '24px',
          bottom: '16px',
        },
      ],
      axisPointer: {
        // Link the two series x-axis together.
        link: [{xAxisIndex: [0, 1]}],
      },
      xAxes: [
        {
          gridIndex: 0,
          type: 'time',
        },
        {
          gridIndex: 1,
          type: 'time',
        },
      ],
      yAxes: [
        {
          gridIndex: 0,
          min({min}: {min: number}) {
            // Scale to the nearest 0.x
            return Math.floor(min * 10) / 10;
          },
        },
        {
          gridIndex: 1,
          min({min}: {min: number}) {
            // Round to the nearest integer.
            return Math.floor(min);
          },
        },
      ],
      utc,
      isGroupedByDate: true,
      showTimeInTooltip: true,
      colors: [colors[0], colors[0]],
    };

    if (loading) {
      return <AreaChart series={[]} {...areaChartProps} />;
    }
    const series = data.map((values, i: number) => ({
      ...values,
      yAxisIndex: i,
      xAxisIndex: i,
    }));

    return (
      <ChartZoom
        router={router}
        period={statsPeriod}
        utc={utc}
        projects={projects}
        environments={environments}
        xAxisIndex={[0, 1]}
      >
        {zoomRenderProps => (
          <AreaChart {...zoomRenderProps} series={series} {...areaChartProps} />
        )}
      </ChartZoom>
    );
  }
}

export default Chart;
