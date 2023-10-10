import type {Series} from 'sentry/types/echarts';

import ScatterSeries from './series/scatterSeries';
import BaseChart, {BaseChartProps} from './baseChart';

export type ScatterChartSeries = Series;

interface Props extends Omit<BaseChartProps, 'series'> {
  series: ScatterChartSeries[];
}

function ScatterChart({series, ...props}: Props) {
  return (
    <BaseChart
      {...props}
      xAxis={{
        // do not want the axis pointer when working with scatter charts
        axisPointer: {
          show: false,
          ...props.xAxis?.axisPointer,
        },
        ...props.xAxis,
      }}
      series={series.map(({seriesName, data, ...options}) =>
        ScatterSeries({
          name: seriesName,
          data: data.map(({name, value}) => [name, value]),
          ...options,
          animation: false,
        })
      )}
    />
  );
}

export default ScatterChart;
