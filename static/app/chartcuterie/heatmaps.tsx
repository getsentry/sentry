import type {Theme} from '@emotion/react';

import {Grid} from 'sentry/components/charts/components/grid';
import type {HeatMapSeries} from 'sentry/views/dashboards/widgets/common/types';
import {formatYAxisValue} from 'sentry/views/dashboards/widgets/heatMapWidget/formatters/formatYAxisValue';
import {visualMapOptions} from 'sentry/views/dashboards/widgets/heatMapWidget/heatMapWidgetVisualization';
import {HeatMap} from 'sentry/views/dashboards/widgets/heatMapWidget/plottables/heatMap';
import {HEATMAP_COLORS} from 'sentry/views/dashboards/widgets/heatMapWidget/settings';
import {formatXAxisTimestamp} from 'sentry/views/dashboards/widgets/timeSeriesWidget/formatters/formatXAxisTimestamp';

import {DEFAULT_FONT_FAMILY} from './slack';
import {CHART_SIZE, FONT_SIZE} from './timeseries';
import type {RenderDescriptor} from './types';
import {ChartType} from './types';

type HeatMapChartData = {
  heatmap: HeatMapSeries;
};

export function buildHeatmapChartOption({
  theme,
  heatMapSeries,
}: {
  heatMapSeries: HeatMapSeries;
  theme: Theme;
}) {
  const heatMapPlottable = new HeatMap(heatMapSeries);

  const yAxisDataType = heatMapPlottable.yAxisValueType;
  const yAxisDataUnit = heatMapPlottable.yAxisValueUnit;

  // The full value range of the buckets. `start` is the first bucket's lower
  // bound and `end` is the last bucket's upper bound. We pin an overlaid value
  // axis to this range so ECharts can place round ticks on it (see `yAxis`).
  const yAxisMin = heatMapPlottable.heatMapSeries.meta.yAxis.start;
  const yAxisMax = heatMapPlottable.heatMapSeries.meta.yAxis.end;

  const series = heatMapPlottable.toSeries({theme});

  return {
    grid: Grid({left: 10, right: 10, bottom: 10, top: 10}),
    backgroundColor: theme.tokens.background.primary,
    xAxis: {
      type: 'category',
      axisLabel: {
        formatter: (value: string) => {
          // NOTE: ECharts requires a `"category"` X-axis for heat maps, but we _know_ that we only support time as the X-axis. We need to parse the value here.
          return formatXAxisTimestamp(parseFloat(value), {
            utc: true,
          });
        },
        fontSize: FONT_SIZE,
        fontFamily: DEFAULT_FONT_FAMILY,
      },
      axisLine: {
        show: false,
      },
      axisPointer: {
        show: false,
      },
      splitArea: {
        show: false,
      },
    },
    yAxis: [
      // Category axis: positions the heat map cells (ECharts requires a
      // category axis for heat map series). Its categories are the bucket
      // boundaries, which are rarely round, so we hide its labels and let the
      // overlaid value axis render readable ticks instead.
      //
      // We deliberately don't set `data` here: ECharts collects the categories
      // from the series' Y values and matches cells to them by value. Supplying
      // our own category list would make ECharts treat those same Y values as
      // category *indices* instead, dropping every cell whose value isn't a
      // valid index.
      {
        type: 'category',
        animation: false,
        axisLabel: {
          show: false,
        },
        axisLine: {
          show: false,
        },
        axisTick: {
          show: false,
        },
        axisPointer: {
          show: false,
        },
        splitArea: {
          show: false,
        },
      },
      // Value axis (overlay): spans the full value range of the buckets and
      // lets ECharts place round ticks on it. These don't line up with the
      // bucket boundaries, they just read cleanly. A second y-axis defaults to
      // the right, so we pin it to the left explicitly. The min/max labels are
      // hidden because `start`/`end` are themselves bucket boundaries and
      // rarely round.
      {
        type: 'value',
        position: 'left',
        min: yAxisMin,
        max: yAxisMax,
        animation: false,
        axisLabel: {
          hideOverlap: true,
          showMinLabel: false,
          showMaxLabel: false,
          formatter: (value: number) =>
            formatYAxisValue(value, yAxisDataType, yAxisDataUnit ?? undefined),
          fontSize: FONT_SIZE,
          fontFamily: DEFAULT_FONT_FAMILY,
        },
        axisLine: {
          show: false,
        },
        splitLine: {
          show: false,
        },
      },
    ],
    series,
    visualMap: visualMapOptions(HEATMAP_COLORS),
    useUTC: true,
  };
}

export const makeHeatmapCharts = (theme: Theme): Array<RenderDescriptor<ChartType>> => [
  {
    key: ChartType.SLACK_HEATMAP,
    getOption: (data: HeatMapChartData) =>
      buildHeatmapChartOption({
        theme,
        heatMapSeries: data.heatmap,
      }),
    ...CHART_SIZE,
  },
];
