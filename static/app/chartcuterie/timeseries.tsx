import type {Theme} from '@emotion/react';

import {Grid} from 'sentry/components/charts/components/grid';
import {Legend} from 'sentry/components/charts/components/legend';
import {XAxis} from 'sentry/components/charts/components/xAxis';
import {YAxis} from 'sentry/components/charts/components/yAxis';
import {DisplayType} from 'sentry/views/dashboards/types';
import type {TimeSeries} from 'sentry/views/dashboards/widgets/common/types';
import {formatTimeSeriesLabel} from 'sentry/views/dashboards/widgets/timeSeriesWidget/formatters/formatTimeSeriesLabel';
import {formatYAxisValue} from 'sentry/views/dashboards/widgets/timeSeriesWidget/formatters/formatYAxisValue';
import type {ContinuousTimeSeriesPlottingOptions} from 'sentry/views/dashboards/widgets/timeSeriesWidget/plottables/continuousTimeSeries';
import {createPlottableFromTimeSeries} from 'sentry/views/dashboards/widgets/timeSeriesWidget/plottables/createPlottableFromTimeSeries';
import type {Plottable} from 'sentry/views/dashboards/widgets/timeSeriesWidget/plottables/plottable';

import {DEFAULT_FONT_FAMILY} from './slack';
import type {RenderDescriptor} from './types';
import {ChartType} from './types';

/**
 * Font size and spacing scaled for the larger timeseries chart canvas (1200x400).
 */
const FONT_SIZE = 28;
export const CHART_SIZE = {width: 1200, height: 400};

/**
 * Builds a y-axis axisLabel formatter from the first timeseries metadata.
 */
function makeYAxisFormatter(timeSeries: TimeSeries[]) {
  const firstSeries = timeSeries[0];
  const valueType = firstSeries?.meta?.valueType ?? 'number';
  const valueUnit = firstSeries?.meta?.valueUnit;

  return (value: number) => formatYAxisValue(value, valueType, valueUnit ?? undefined);
}

export type TimeseriesChartData = {
  timeSeries: TimeSeries[];
  type?: DisplayType;
};

/**
 * Per-series callback passed to {@link buildTimeseriesChartOption}. The
 * dashboards-widget renderer overrides this to feed a widget-aware label
 * (alias + conditions prefix) into the plottable; everything else about the
 * chart — axes, legend, color palette, stacking, sort order — stays the
 * same as ``SLACK_TIMESERIES``.
 */
export type CreatePlottableForTimeseriesChart<T extends TimeSeries = TimeSeries> = (
  ts: T,
  options: {color: string | undefined; hasGroups: boolean; index: number}
) => Plottable | null;

/**
 * Top edge (in px) of the plot area in chartcuterie's timeseries charts.
 * Used by both the grid config and the threshold plottable's ``maxOffset``,
 * so "infinite" threshold mark lines / mark areas anchor at the top of the
 * data grid instead of overlapping the legend.
 */
const GRID_TOP_OFFSET = 60;

/**
 * Builds the ECharts option for a chartcuterie timeseries chart. Shared
 * between ``SLACK_TIMESERIES`` and ``SLACK_DASHBOARDS_WIDGET``; the only
 * difference between the two is the plottable factory ``createPlottable``,
 * which is also where the ``displayType`` is consumed.
 */
export function buildTimeseriesChartOption<T extends TimeSeries>({
  theme,
  timeSeries,
  createPlottable,
  extraPlottables = [],
}: {
  createPlottable: CreatePlottableForTimeseriesChart<T>;
  theme: Theme;
  timeSeries: T[];
  extraPlottables?: Plottable[];
}) {
  const xAxis = XAxis({
    theme,
    splitNumber: 3,
    isGroupedByDate: true,
    axisLabel: {fontSize: FONT_SIZE, fontFamily: DEFAULT_FONT_FAMILY},
  });

  const defaults = {
    grid: Grid({left: 10, right: 10, bottom: 10, top: GRID_TOP_OFFSET}),
    backgroundColor: theme.tokens.background.primary,
    legend: Legend({
      theme,
      icon: 'roundRect',
      itemHeight: 16,
      itemWidth: 16,
      itemGap: 16,
      top: 6,
      left: 10,
      truncate: 20,
      textStyle: {
        fontSize: FONT_SIZE * 0.8,
        lineHeight: FONT_SIZE * 1.1,
        fontFamily: DEFAULT_FONT_FAMILY,
      },
      pageTextStyle: {
        fontSize: FONT_SIZE,
        fontFamily: DEFAULT_FONT_FAMILY,
      },
      pageIconSize: FONT_SIZE * 0.6,
    }),
    yAxis: YAxis({
      theme,
      splitNumber: 3,
      axisLabel: {fontSize: FONT_SIZE, fontFamily: DEFAULT_FONT_FAMILY},
    }),
  };

  if (timeSeries.length === 0) {
    return {
      ...defaults,
      xAxis,
      useUTC: true,
      series: [],
    };
  }

  const yAxis = YAxis({
    theme,
    splitNumber: 3,
    axisLabel: {
      fontSize: FONT_SIZE,
      fontFamily: DEFAULT_FONT_FAMILY,
      formatter: makeYAxisFormatter(timeSeries),
    },
  });

  const hasGroups = timeSeries.some(ts => ts.groupBy && ts.groupBy.length > 0);

  // Grouped widgets stack in order, with the "Other" bucket pinned to a
  // neutral color. Ungrouped widgets keep the response order.
  const sorted = hasGroups
    ? timeSeries.slice().sort((a, b) => (a.meta?.order ?? 0) - (b.meta?.order ?? 0))
    : timeSeries;
  const hasOther = hasGroups && sorted.some(ts => ts.meta?.isOther);
  const color = theme.chart
    .getColorPalette(sorted.length - 1 - (hasOther ? 1 : 0))
    ?.slice() as string[];
  if (hasOther) {
    color.push(theme.tokens.content.secondary);
  }

  const series = sorted.flatMap((ts, i) => {
    const plottingOptions: ContinuousTimeSeriesPlottingOptions = {
      color: color?.[i] ?? '',
      unit: ts.meta?.valueUnit ?? null,
      yAxisPosition: 'left',
    };
    const plottable = createPlottable(ts, {color: color?.[i], hasGroups, index: i});
    return plottable?.toSeries(plottingOptions) ?? [];
  });

  const extraSeries = extraPlottables.flatMap(plottable =>
    plottable.toSeries({
      color: '',
      unit: null,
      yAxisPosition: 'left',
      theme,
      maxOffset: GRID_TOP_OFFSET,
    })
  );

  return {
    ...defaults,
    yAxis,
    xAxis,
    useUTC: true,
    color,
    series: [...series, ...extraSeries],
  };
}

export const makeTimeseriesCharts = (
  theme: Theme
): Array<RenderDescriptor<ChartType>> => [
  {
    key: ChartType.SLACK_TIMESERIES,
    getOption: (data: TimeseriesChartData) =>
      buildTimeseriesChartOption({
        theme,
        timeSeries: data.timeSeries,
        createPlottable: (ts, {color, hasGroups}) =>
          createPlottableFromTimeSeries(data.type ?? DisplayType.LINE, ts, {
            name: formatTimeSeriesLabel(ts),
            color,
            stack: hasGroups ? 'all' : undefined,
          }),
      }),
    ...CHART_SIZE,
  },
];
