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

import {DEFAULT_FONT_FAMILY} from './slack';
import type {RenderDescriptor} from './types';
import {ChartType} from './types';

/**
 * Font size and spacing scaled for the larger timeseries chart canvas (1200x400).
 */
const FONT_SIZE = 28;
const CHART_SIZE = {width: 1200, height: 400};

/**
 * Maximum legend entries shown on the static unfurl image. Anything beyond
 * this is collapsed into a "+N more" indicator so the legend stays on a
 * single row (the unfurl is non-interactive, so pagination/wrapping aren't
 * useful — users click through to the live chart to see everything).
 */
const MAX_LEGEND_ITEMS = 4;

/**
 * Builds the legend.data array and a synthetic placeholder series for the
 * "+N more" overflow indicator.
 *
 * ECharts silently drops legend.data entries that don't match a series name
 * (see LegendView.js — items are only drawn when getSeriesByName matches or a
 * legendVisualProvider claims them). So to render an overflow indicator we
 * must also push an empty series whose name matches.
 *
 * The slice keeps the total entry count at MAX_LEGEND_ITEMS even when
 * overflowing, so the legend never wraps off the reserved single row.
 */
function buildBoundedLegend(names: string[]) {
  // Dedupe first: grouped multi-yAxis responses produce one TimeSeries per
  // (group, yAxis) pair, but `formatTimeSeriesLabel` returns just the group
  // when groupBy is present. Without dedup, duplicates would consume cap
  // slots and inflate the "+N more" count.
  const uniqueNames = Array.from(new Set(names));
  if (uniqueNames.length <= MAX_LEGEND_ITEMS) {
    return {data: uniqueNames, indicatorSeries: []};
  }
  const visibleCount = MAX_LEGEND_ITEMS - 1;
  const hiddenCount = uniqueNames.length - visibleCount;
  const indicatorName = `+${hiddenCount} more`;
  return {
    data: [...uniqueNames.slice(0, visibleCount), {name: indicatorName, icon: 'none'}],
    // Empty line series gives ECharts a name to match the legend entry to.
    // No data points means nothing is plotted; `silent` suppresses tooltips.
    indicatorSeries: [
      {type: 'line' as const, name: indicatorName, data: [], silent: true},
    ],
  };
}

/**
 * Builds a y-axis axisLabel formatter from the first timeseries metadata.
 */
function makeYAxisFormatter(timeSeries: TimeSeries[]) {
  const firstSeries = timeSeries[0];
  const valueType = firstSeries?.meta?.valueType ?? 'number';
  const valueUnit = firstSeries?.meta?.valueUnit;

  return (value: number) => formatYAxisValue(value, valueType, valueUnit ?? undefined);
}

type ChartData = {
  timeSeries: TimeSeries[];
  type?: DisplayType;
};

export const makeTimeseriesCharts = (
  theme: Theme
): Array<RenderDescriptor<ChartType>> => {
  const xAxis = XAxis({
    theme,
    splitNumber: 3,
    isGroupedByDate: true,
    axisLabel: {fontSize: FONT_SIZE, fontFamily: DEFAULT_FONT_FAMILY},
  });

  const defaults = {
    grid: Grid({left: 10, right: 10, bottom: 10, top: 60}),
    backgroundColor: theme.tokens.background.primary,
    legend: Legend({
      theme,
      // 'plain' disables ECharts' built-in legend pagination, which is non-functional
      // on a static unfurl image. Overflow is bounded via `data` below (see MAX_LEGEND_ITEMS).
      type: 'plain',
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
    }),
    yAxis: YAxis({
      theme,
      splitNumber: 3,
      axisLabel: {fontSize: FONT_SIZE, fontFamily: DEFAULT_FONT_FAMILY},
    }),
  };

  const charts: Array<RenderDescriptor<ChartType>> = [];

  charts.push({
    key: ChartType.SLACK_TIMESERIES,
    getOption: (data: ChartData) => {
      const {timeSeries, type: displayType = DisplayType.LINE} = data;

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

      if (!hasGroups) {
        const color = theme.chart
          .getColorPalette(timeSeries.length - 1)
          ?.slice() as string[];

        const series = timeSeries.flatMap((ts, i) => {
          const plottingOptions: ContinuousTimeSeriesPlottingOptions = {
            color: color?.[i] ?? '',
            unit: ts.meta?.valueUnit ?? null,
            yAxisPosition: 'left',
          };
          const plottable = createPlottableFromTimeSeries(displayType, ts, {
            name: formatTimeSeriesLabel(ts),
            color: color?.[i],
          });
          return plottable?.toSeries(plottingOptions) ?? [];
        });

        const legend = buildBoundedLegend(
          timeSeries.map(ts => formatTimeSeriesLabel(ts))
        );

        return {
          ...defaults,
          legend: {...defaults.legend, data: legend.data},
          yAxis,
          xAxis,
          useUTC: true,
          color,
          series: [...series, ...legend.indicatorSeries],
        };
      }

      const sorted = timeSeries
        .slice()
        .sort((a, b) => (a.meta?.order ?? 0) - (b.meta?.order ?? 0));
      const hasOther = sorted.some(ts => ts.meta?.isOther);
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
        const plottable = createPlottableFromTimeSeries(displayType, ts, {
          name: formatTimeSeriesLabel(ts),
          color: color?.[i],
          stack: 'all',
        });
        return plottable?.toSeries(plottingOptions) ?? [];
      });

      const legend = buildBoundedLegend(sorted.map(ts => formatTimeSeriesLabel(ts)));

      return {
        ...defaults,
        legend: {...defaults.legend, data: legend.data},
        yAxis,
        xAxis,
        useUTC: true,
        color,
        series: [...series, ...legend.indicatorSeries],
      };
    },
    ...CHART_SIZE,
  });

  return charts;
};
