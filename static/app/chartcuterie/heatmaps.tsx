import type {Theme} from '@emotion/react';

import {Grid} from 'sentry/components/charts/components/grid';
import {YAxis} from 'sentry/components/charts/components/yAxis';
import type {HeatMapSeries} from 'sentry/views/dashboards/widgets/common/types';
import {formatYAxisValue} from 'sentry/views/dashboards/widgets/heatMapWidget/formatters/formatYAxisValue';
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
  const Zmax = heatMapPlottable.Zend;

  const yAxis = YAxis({
    theme,
    type: 'category',
    splitLine: {show: false},
    axisLabel: {
      showMinLabel: true,
      showMaxLabel: true,
      hideOverlap: true,
      fontSize: FONT_SIZE,
      fontFamily: DEFAULT_FONT_FAMILY,
      formatter: (value: string) =>
        formatYAxisValue(parseFloat(value), yAxisDataType, yAxisDataUnit ?? undefined),
    },
  });

  // we have log as default currently so we'll keep that in the unfurl
  const series = heatMapPlottable.toSeries({theme, scale: 'log'});

  return {
    grid: Grid({left: 10, right: 10, bottom: 10, top: 10}),
    backgroundColor: theme.tokens.background.primary,
    // ECharts requires type:'category' for heatmap axes
    xAxis: {
      type: 'category',
      axisLabel: {
        fontSize: FONT_SIZE,
        fontFamily: DEFAULT_FONT_FAMILY,
        formatter: (value: string) => {
          // NOTE: ECharts requires a `"category"` X-axis for heat maps, but we _know_ that we only support time as the X-axis. We need to parse the value here.
          return formatXAxisTimestamp(parseFloat(value));
        },
      },
      axisPointer: {show: false},
      splitArea: {show: false},
    },
    yAxis,
    useUTC: true,
    series,
    visualMap: [
      // Zero values are transparent (empty buckets)
      {
        type: 'piecewise',
        show: false,
        dimension: 2,
        seriesIndex: 0,
        pieces: [
          {value: 0, opacity: 0},
          {gt: 0, opacity: 1},
        ],
      },
      // All values are plotted against the heatmap palette
      {
        type: 'continuous',
        show: false,
        dimension: 2,
        seriesIndex: 0,
        min: 0,
        max: Zmax,
        inRange: {
          color: [...HEATMAP_COLORS],
        },
      },
    ],
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
