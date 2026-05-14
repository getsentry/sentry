import 'echarts/lib/chart/heatmap';

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
  /**
   * Experimental! Specify the Z-axis scale type. Logarithmic scales can be much more useful for values with a high range.
   */
  scale?: 'linear' | 'log';
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

  const {scale = 'linear'} = props;

  const series = plottables.flatMap(plottable =>
    plottable.toSeries({
      theme,
      scale,
    })
  );

  const heatMapPlottable = plottables[0];

  const yAxisDataType = heatMapPlottable.yAxisValueType;
  const yAxisDataUnit = heatMapPlottable.yAxisValueUnit;

  const Zmax =
    scale === 'log' ? Math.log1p(heatMapPlottable.Zend) : heatMapPlottable.Zend;

  return (
    <Flex direction="column" height="100%">
      <BaseChart
        autoHeightResize
        // will be grouped by date as we only support time as the x-axis right now.
        // TODO(nikki): eventually this will change later and we'll pass in what kind of x-axis we have
        isGroupedByDate
        showTimeInTooltip
        tooltip={{
          show: true,
          axisPointer: {
            show: false,
          },
          triggerOn: 'click',
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
            hideOverlap: true,
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
        visualMap={[
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
          // All values are plotted against a palette
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
        ]}
        start={start ? new Date(start) : undefined}
        end={end ? new Date(end) : undefined}
        period={period}
        utc={utc ?? undefined}
      />
    </Flex>
  );
}
