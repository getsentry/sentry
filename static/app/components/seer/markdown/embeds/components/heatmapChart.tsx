import 'echarts/lib/chart/heatmap';

import type {HeatmapSeriesOption} from 'echarts';

import {BaseChart} from 'sentry/components/charts/baseChart';
import {getUserTimezone} from 'sentry/utils/dates';
import {HEATMAP_COLORS} from 'sentry/views/dashboards/widgets/heatMapWidget/settings';
import {formatXAxisTimestamp} from 'sentry/views/dashboards/widgets/timeSeriesWidget/formatters/formatXAxisTimestamp';

import type {ChartAxis, ChartSeries} from './chartTypes';

interface HeatmapChartProps {
  series: ChartSeries[];
  valueFormatter: (value: number) => string;
  xAxis: ChartAxis;
}

export function HeatmapChart({series, valueFormatter, xAxis}: HeatmapChartProps) {
  const columns = Array.from(
    new Set(series.flatMap(item => item.data.map(point => point.name)))
  );
  const columnIndexes = new Map(columns.map((column, index) => [column, index]));
  const rows = series.map(item => item.seriesName);
  const cells = series.flatMap((item, rowIndex) =>
    item.data.map(point => [columnIndexes.get(point.name)!, rowIndex, point.value])
  );
  const maxValue = Math.max(1, ...cells.map(cell => cell[2]!));
  const formatColumn = (value: string | number) =>
    xAxis === 'time'
      ? formatXAxisTimestamp(Number(value), getUserTimezone())
      : String(value);
  const heatmapSeries: HeatmapSeriesOption = {
    type: 'heatmap',
    name: 'Heatmap',
    data: cells,
    emphasis: {
      itemStyle: {
        borderWidth: 1,
      },
    },
  };

  return (
    <BaseChart
      animation={false}
      grid={{left: 12, right: 12, top: 12, bottom: 8, containLabel: true}}
      height={220}
      renderer="svg"
      series={[heatmapSeries]}
      tooltip={{
        trigger: 'item',
        renderMode: 'richText',
        formatter: rawParams => {
          const params = Array.isArray(rawParams) ? rawParams[0] : rawParams;
          if (!params) {
            return '';
          }
          const [columnIndex, rowIndex, value] = params.value as [number, number, number];
          return `${rows[rowIndex]}\n${formatColumn(columns[columnIndex]!)}: ${valueFormatter(value)}`;
        },
      }}
      visualMap={{
        type: 'continuous',
        show: false,
        min: 0,
        max: maxValue,
        inRange: {color: [...HEATMAP_COLORS]},
      }}
      xAxis={{
        type: 'category',
        data: columns,
        axisLabel: {formatter: value => formatColumn(value)},
      }}
      yAxis={{type: 'category', data: rows}}
    />
  );
}
