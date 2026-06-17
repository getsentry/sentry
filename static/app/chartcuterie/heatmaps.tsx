import type {Theme} from '@emotion/react';

import {Grid} from 'sentry/components/charts/components/grid';
import {YAxis} from 'sentry/components/charts/components/yAxis';
import type {HeatMapSeries} from 'sentry/views/dashboards/widgets/common/types';
import {formatYAxisValue} from 'sentry/views/dashboards/widgets/heatMapWidget/formatters/formatYAxisValue';
import {
  visualMapOptions,
  xAxisOptions,
} from 'sentry/views/dashboards/widgets/heatMapWidget/heatMapWidgetVisualization';
import {HeatMap} from 'sentry/views/dashboards/widgets/heatMapWidget/plottables/heatMap';

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

  const xAxis = xAxisOptions(null);

  return {
    grid: Grid({left: 10, right: 10, bottom: 10, top: 10}),
    backgroundColor: theme.tokens.background.primary,
    // ECharts requires type:'category' for heatmap axes
    xAxis: {
      ...xAxis,
      axisLabel: {
        ...xAxis.axisLabel,
        fontSize: FONT_SIZE,
        fontFamily: DEFAULT_FONT_FAMILY,
      },
    },
    yAxis,
    useUTC: true,
    series,
    visualMap: visualMapOptions(Zmax),
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
