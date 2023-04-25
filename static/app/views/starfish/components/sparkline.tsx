import {LineChart} from 'echarts/charts';
import * as echarts from 'echarts/core';
import {SVGRenderer} from 'echarts/renderers';
import ReactEChartsCore from 'echarts-for-react/lib/core';

import {Series} from 'sentry/types/echarts';

export const HOST = 'http://localhost:8080';

type SparklineProps = {
  series: Series;
};

export default function Sparkline({series}: SparklineProps) {
  echarts.use([LineChart, SVGRenderer]);

  const valueSeries = {
    data: series.data.map(datum => datum.value),
    type: 'line',
    showSymbol: false,
    smooth: true,
  };

  return (
    <ReactEChartsCore
      echarts={echarts}
      option={{
        series: [valueSeries],
        xAxis: {
          show: false,
          data: series.data.map(datum => datum.name),
          type: 'category',
        },
        yAxis: {
          show: false,
          type: 'value',
        },
        grid: {
          left: 3,
          top: 3,
          right: 3,
          bottom: 3,
        },
      }}
      notMerge
      style={{
        height: 25,
        width: 300,
      }}
      lazyUpdate
      theme="theme_name"
    />
  );
}
