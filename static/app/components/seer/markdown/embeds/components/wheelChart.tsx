import 'echarts/lib/chart/pie';

import type {PieSeriesOption} from 'echarts';

import {BaseChart} from 'sentry/components/charts/baseChart';

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
      height={220}
      renderer="svg"
      series={[wheelSeries]}
      tooltip={{
        trigger: 'item',
        renderMode: 'richText',
        formatter: rawParams => {
          const params = Array.isArray(rawParams) ? rawParams[0] : rawParams;
          if (!params) {
            return '';
          }
          return `${params.name}: ${valueFormatter(Number(params.value))}`;
        },
      }}
      xAxis={null}
      yAxis={null}
    />
  );
}
