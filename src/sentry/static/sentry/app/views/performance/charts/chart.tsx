import React from 'react';
import * as ReactRouter from 'react-router';
import max from 'lodash/max';

import {Series} from 'app/types/echarts';
import AreaChart from 'app/components/charts/areaChart';
import ChartZoom from 'app/components/charts/chartZoom';
import theme from 'app/utils/theme';

import {PERCENTILE_NAMES} from '../constants';

type Props = {
  data: Series[];
  router: ReactRouter.InjectedRouter;
  statsPeriod: string | undefined;
  utc: boolean;
  projects: number[];
  environments: string[];
  loading: boolean;
};

function roundAxis(x) {
  const exp10 = 10 ** Math.floor(Math.log10(x));
  return Math.ceil(x / exp10) * exp10;
}

class Chart extends React.Component<Props> {
  render() {
    const {data, router, statsPeriod, utc, projects, environments, loading} = this.props;

    if (!data || data.length <= 0) {
      return null;
    }
    const colors = theme.charts.getColorPalette(4);

    const dataMax = data.every(value => PERCENTILE_NAMES.has(value.seriesName))
      ? roundAxis(max(data.map(value => max(value.data.map(point => point.value)))))
      : undefined;

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
          scale: true,
          max: dataMax,
        },
        {
          gridIndex: 1,
          scale: true,
          max: dataMax,
        },
      ],
      utc,
      isGroupedByDate: true,
      showTimeInTooltip: true,
      colors: [colors[0], colors[1]],
      tooltip: {
        nameFormatter(value) {
          return value === 'epm()' ? 'tpm()' : value;
        },
      },
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
