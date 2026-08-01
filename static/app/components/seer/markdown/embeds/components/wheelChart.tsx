import 'echarts/lib/chart/pie';

import type {PieSeriesOption} from 'echarts';

import {BaseChart} from 'sentry/components/charts/baseChart';
import {escape} from 'sentry/utils';

import type {ChartSeries} from './chartTypes';

interface WheelChartProps {
  series: ChartSeries;
  valueFormatter: (value: number) => string;
}

export function WheelChart({series, valueFormatter}: WheelChartProps) {
  const wheelSeries: PieSeriesOption = {
    type: 'pie',
    name: series.seriesName,
    radius: ['40%', '70%'],
    data: series.data.map(point => ({name: String(point.name), value: point.value})),
    label: {formatter: '{b}: {d}%'},
    avoidLabelOverlap: true,
  };

  return (
    <BaseChart
      animation={false}
      colors={theme => theme.chart.getColorPalette(series.data.length)}
      height={220}
      renderer="svg"
      series={[wheelSeries]}
      tooltip={{
        trigger: 'item',
        formatter: rawParams => {
          const params = Array.isArray(rawParams) ? rawParams[0] : rawParams;
          if (!params) {
            return '';
          }
          return `<div class="tooltip-series"><div><span class="tooltip-label"><strong>${escape(String(params.name))}</strong></span> ${valueFormatter(Number(params.value))}</div></div>`;
        },
      }}
      xAxis={null}
      yAxis={null}
    />
  );
}
