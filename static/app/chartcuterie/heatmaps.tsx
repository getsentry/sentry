import type {Theme} from '@emotion/react';

import {Grid} from 'sentry/components/charts/components/grid';
import type {HeatMapSeries} from 'sentry/views/dashboards/widgets/common/types';
import {visualMapOptions} from 'sentry/views/dashboards/widgets/heatMapWidget/heatMapWidgetVisualization';
import {HeatMap} from 'sentry/views/dashboards/widgets/heatMapWidget/plottables/heatMap';
import {HEATMAP_COLORS} from 'sentry/views/dashboards/widgets/heatMapWidget/settings';
import {
  HIDDEN_CATEGORY_AXIS,
  heatMapTimeAxis,
  heatMapValueAxis,
} from 'sentry/views/dashboards/widgets/heatMapWidget/utils/heatMapAxes';

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
  const {xAxis: xAxisMeta, yAxis: yAxisMeta} = heatMapSeries.meta;

  // Chartcuterie is more limited in rendering, so it sets its own font
  // properties. Also we're not using the `YAxis` and `XAxis` base helpers here,
  // so we have a bit more control
  const labelFont = {fontSize: FONT_SIZE, fontFamily: DEFAULT_FONT_FAMILY};

  const timeAxis = heatMapTimeAxis({min: xAxisMeta.start, max: xAxisMeta.end, utc: true});
  const valueAxis = heatMapValueAxis({
    min: yAxisMeta.start,
    max: yAxisMeta.end,
    valueType: heatMapPlottable.yAxisValueType,
    valueUnit: heatMapPlottable.yAxisValueUnit ?? undefined,
  });

  return {
    grid: Grid({left: 10, right: 10, bottom: 10, top: 10}),
    backgroundColor: theme.tokens.background.primary,
    xAxis: [
      HIDDEN_CATEGORY_AXIS,
      {...timeAxis, axisLabel: {...timeAxis.axisLabel, ...labelFont}},
    ],
    yAxis: [
      HIDDEN_CATEGORY_AXIS,
      {...valueAxis, axisLabel: {...valueAxis.axisLabel, ...labelFont}},
    ],
    series: heatMapPlottable.toSeries({theme}),
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
