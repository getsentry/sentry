import React from 'react';
import {EChartOption} from 'echarts';

import {Series} from 'app/types/echarts';

import AreaSeries from './series/areaSeries';
import BaseChart from './baseChart';

type ChartProps = React.ComponentProps<typeof BaseChart>;

export type AreaChartSeries = Series &
  Omit<EChartOption.SeriesLine, 'data' | 'name' | 'lineStyle'> & {
    lineStyle?: any; // TODO(ts): Fix when echarts type is updated so that EchartOption.LineStyle matches SeriesLine['lineStyle']
  };

type Props = Omit<ChartProps, 'series'> & {
  stacked?: boolean;
  series: AreaChartSeries[];
};

class AreaChart extends React.Component<Props> {
  render() {
    const {series, stacked, colors, ...props} = this.props;

    return (
      <BaseChart
        {...props}
        series={series.map(({seriesName, data, ...otherSeriesProps}, i) =>
          AreaSeries({
            stack: stacked ? 'area' : undefined,
            name: seriesName,
            data: data.map(({name, value}) => [name, value]),
            lineStyle: {
              color: colors?.[i],
              opacity: 1,
              width: 0.4,
            },
            areaStyle: {
              color: colors?.[i],
              opacity: 1.0,
            },
            animation: false,
            animationThreshold: 1,
            animationDuration: 0,
            ...otherSeriesProps,
          })
        )}
      />
    );
  }
}

export default AreaChart;
