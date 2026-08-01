import 'echarts/lib/chart/heatmap';

import type {HeatmapSeriesOption} from 'echarts';
import moment from 'moment-timezone';

import {BaseChart} from 'sentry/components/charts/baseChart';
import {escape} from 'sentry/utils';
import {getTimeFormat, getUserTimezone} from 'sentry/utils/dates';
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
  if (xAxis === 'time') {
    columns.sort((left, right) => Number(left) - Number(right));
  }
  const columnIndexes = new Map(columns.map((column, index) => [column, index]));
  const rows = series.map(item => item.seriesName);
  const cells = series.flatMap((item, rowIndex) =>
    item.data.map(point => [columnIndexes.get(point.name)!, rowIndex, point.value])
  );
  const maxValue = Math.max(1, ...cells.map(cell => cell[2]!));
  const timezone = getUserTimezone();
  const timeColumnDates =
    xAxis === 'time' ? columns.map(column => moment.tz(Number(column), timezone)) : [];
  const spansMultipleDays =
    new Set(timeColumnDates.map(date => date.format('YYYY-MM-DD'))).size > 1;
  const spansMultipleYears =
    new Set(timeColumnDates.map(date => date.format('YYYY'))).size > 1;
  const formatColumn = (value: string | number) => {
    if (xAxis !== 'time') {
      return String(value);
    }
    if (!spansMultipleDays) {
      return formatXAxisTimestamp(Number(value), timezone);
    }
    const format = spansMultipleYears
      ? `MMM D YYYY, ${getTimeFormat()}`
      : `MMM D, ${getTimeFormat()}`;
    return moment.tz(Number(value), timezone).format(format);
  };
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
        formatter: rawParams => {
          const params = Array.isArray(rawParams) ? rawParams[0] : rawParams;
          if (!params) {
            return '';
          }
          const [columnIndex, rowIndex, value] = params.value as [number, number, number];
          const row = escape(rows[rowIndex] ?? '');
          const column = escape(formatColumn(columns[columnIndex]!));
          return `<div class="tooltip-series"><div><span class="tooltip-label"><strong>${row}</strong></span> ${column}: ${valueFormatter(value)}</div></div>`;
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
        axisLabel: {
          formatter: value => formatColumn(value),
          showMaxLabel: true,
          showMinLabel: true,
        },
      }}
      yAxis={{type: 'category', data: rows}}
    />
  );
}
