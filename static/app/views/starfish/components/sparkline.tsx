import {LineChart} from 'echarts/charts';
import * as echarts from 'echarts/core';
import {SVGRenderer} from 'echarts/renderers';
import ReactEChartsCore from 'echarts-for-react/lib/core';

import {Series} from 'sentry/types/echarts';

type SparklineProps = {
  series: Series;
  color?: string | string[];
  width?: number;
};

export default function Sparkline({series, width, color}: SparklineProps) {
  echarts.use([LineChart, SVGRenderer]);

  if (!series.data) {
    return null;
  }

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
        color,
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
        width: width ?? 200,
      }}
      lazyUpdate
      theme="theme_name"
    />
  );
}

type MultiSparklineProps = {
  series: Series[];
  color?: string[];
  width?: number;
};

export function MultiSparkline({series, width, color}: MultiSparklineProps) {
  echarts.use([LineChart, SVGRenderer]);

  function getValueSeries(targetSeries, i) {
    return {
      data: targetSeries.data.map(datum => datum.value),
      type: 'line',
      showSymbol: false,
      smooth: true,
      lineStyle: {color: color[i], type: ['solid', 'dotted'][i]},
      yAxisIndex: i,
    };
  }

  return (
    <ReactEChartsCore
      echarts={echarts}
      option={{
        series: series.map((item, index) => getValueSeries(item, index)),
        xAxis: {
          show: false,
          data: getValueSeries(series[0]).data.map(datum => datum.name),
          type: 'category',
        },
        yAxis: [
          {
            show: false,
            type: 'value',
          },
          {
            show: false,
            type: 'value',
          },
        ],
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
        width: width ?? 200,
      }}
      lazyUpdate
      theme="theme_name"
    />
  );
}
