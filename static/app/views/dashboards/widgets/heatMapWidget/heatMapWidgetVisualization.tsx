import {useTheme} from '@emotion/react';

import {Flex} from '@sentry/scraps/layout';

import {BaseChart} from 'sentry/components/charts/baseChart';
import {usePageFilters} from 'sentry/components/pageFilters/usePageFilters';
import {NO_PLOTTABLE_VALUES} from 'sentry/views/dashboards/widgets/common/settings';
import {plottablesCanBeVisualized} from 'sentry/views/dashboards/widgets/plottablesCanBeVisualized';
import {formatXAxisTimestamp} from 'sentry/views/dashboards/widgets/timeSeriesWidget/formatters/formatXAxisTimestamp';
import {formatYAxisValue} from 'sentry/views/dashboards/widgets/timeSeriesWidget/formatters/formatYAxisValue';

import {HeatMap} from './plottables/heatMap';
import type {HeatMapPlottable} from './plottables/heatMapPlottable';
import {HEATMAP_COLORS} from './settings';

interface HeatMapWidgetVisualizationProps {
  /**
   * An single `HeatMap` object to render on the chart, and any number of other compatible Heat Map plottables.
   */
  plottables: [HeatMap, ...HeatMapPlottable[]];
}

export function HeatMapWidgetVisualization(props: HeatMapWidgetVisualizationProps) {
  const {plottables} = props;
  const theme = useTheme();

  const pageFilters = usePageFilters();
  const {start, end, period, utc} = pageFilters.selection.datetime;

  if (!plottablesCanBeVisualized(plottables)) {
    throw new Error(NO_PLOTTABLE_VALUES);
  }

  // TODO: Would be wise to guard against Y-axis type mismatches, we don't want
  // to support multi-axis here.

  const series = plottables.flatMap(plottable =>
    plottable.toSeries({
      theme,
    })
  );

  const heatMapPlottable = plottables.find(plottable => plottable instanceof HeatMap)!;

  const yAxisDataType = heatMapPlottable.yAxisValueType;
  const yAxisDataUnit = heatMapPlottable.yAxisValueUnit;

  const Zmin = heatMapPlottable.Zstart;
  const Zmax = heatMapPlottable.Zend;
  const Zstep = (Zmax - Zmin) / HEATMAP_COLORS.length;

  return (
    <Flex direction="column" height="100%">
      <BaseChart
        autoHeightResize
        tooltip={{
          show: false,
          axisPointer: {
            show: false,
          },
        }}
        series={series}
        xAxis={{
          type: 'category',
          animation: false,
          axisLabel: {
            formatter: value => {
              // NOTE: ECharts requires a `"category"` X-axis for heat maps, but we _know_ that we only support time as the X-axis. We need to parse the value here.
              return formatXAxisTimestamp(parseFloat(value), {
                utc: utc ?? undefined,
              });
            },
          },
          axisPointer: {
            show: false,
          },
          splitArea: {
            show: false,
          },
        }}
        yAxis={{
          type: 'category',
          animation: false,
          axisLabel: {
            formatter: value => {
              // NOTE: ECharts requires a `"category"` Y-axis for heat maps, but we _know_ that we only support continuous values for the Y-axis. We need to parse the value here.
              return formatYAxisValue(
                parseFloat(value),
                yAxisDataType,
                yAxisDataUnit ?? undefined
              );
            },
          },
          axisPointer: {
            show: false,
          },
          splitArea: {
            show: false,
          },
        }}
        visualMap={{
          show: false,
          type: 'piecewise',
          pieces: [
            {gte: 0, lte: 0, color: 'rgba(0,0,0,0)'},
            ...HEATMAP_COLORS.map((color, i) => ({
              gte: i * Zstep,
              lte: (i + 1) * Zstep,
              color,
            })),
          ],
        }}
        start={start ? new Date(start) : undefined}
        end={end ? new Date(end) : undefined}
        period={period}
        utc={utc ?? undefined}
      />
    </Flex>
  );
}
