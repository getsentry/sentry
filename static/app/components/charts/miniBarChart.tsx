// Import to ensure echarts components are loaded.
import './components/markPoint';

import {useMemo} from 'react';
import {useTheme} from '@emotion/react';
import type {GridComponentOption} from 'echarts';
import set from 'lodash/set';

import {formatAbbreviatedNumber} from 'sentry/utils/formatters';

import {BarChart, BarChartProps, BarChartSeries} from './barChart';
import type {BaseChartProps} from './baseChart';

function makeBaseChartOptions({
  height,
  hideDelay,
  tooltipFormatter,
  labelYAxisExtents,
  showMarkLineLabel,
  grid,
  yAxisOptions,
}: {
  height: number;
  grid?: GridComponentOption;
  hideDelay?: number;
  labelYAxisExtents?: boolean;
  showMarkLineLabel?: boolean;
  tooltipFormatter?: (value: number) => string;
  yAxisOptions?: BarChartProps['yAxis'];
}): Omit<BarChartProps, 'series'> {
  return {
    tooltip: {
      trigger: 'axis',
      hideDelay,
      valueFormatter: tooltipFormatter
        ? (value: number) => tooltipFormatter(value)
        : undefined,
    },
    yAxis: {
      max: getYAxisMaxFn(height),
      splitLine: {
        show: false,
      },
      ...yAxisOptions,
    },
    grid: grid ?? {
      // Offset to ensure there is room for the marker symbols at the
      // default size.
      top: labelYAxisExtents || showMarkLineLabel ? 6 : 0,
      bottom: labelYAxisExtents || showMarkLineLabel ? 4 : 0,
      left: showMarkLineLabel ? 35 : 4,
      right: 0,
    },
    xAxis: {
      axisLine: {
        show: false,
      },
      axisTick: {
        show: false,
        alignWithLabel: true,
      },
      axisLabel: {
        show: false,
      },
      axisPointer: {
        type: 'line' as const,
        label: {
          show: false,
        },
        lineStyle: {
          width: 0,
        },
      },
    },
    options: {
      animation: false,
    },
  };
}

function makeLabelYAxisOptions(tooltipFormatter: Props['tooltipFormatter']) {
  return {
    showMinLabel: true,
    showMaxLabel: true,
    interval: Infinity,
    axisLabel: {
      formatter(value: number) {
        if (tooltipFormatter) {
          return tooltipFormatter(value);
        }
        return formatAbbreviatedNumber(value);
      },
    },
  };
}

const noLabelYAxisOptions = {
  axisLabel: {
    show: false,
  },
};

interface Props extends Omit<BaseChartProps, 'css' | 'colors' | 'series' | 'height'> {
  /**
   * Chart height
   */
  height: number;
  /**
   * Colors to use on the chart.
   */
  colors?: string[];

  /**
   * A list of colors to use on hover.
   * By default hover state will shift opacity from 0.6 to 1.0.
   * You can use this prop to also shift colors on hover.
   */
  emphasisColors?: string[];

  /**
   * Override the default grid padding
   */
  grid?: GridComponentOption;

  /**
   * Delay time for hiding tooltip, in ms.
   */
  hideDelay?: number;

  /**
   * Show max/min values on yAxis
   */
  labelYAxisExtents?: boolean;

  series?: BarChartProps['series'];

  /**
   * Whether not we show a MarkLine label
   */
  showMarkLineLabel?: boolean;

  /**
   * Whether not the series should be stacked.
   *
   * Some of our stats endpoints return data where the 'total' series includes
   * breakdown data (issues). For these results `stacked` should be false.
   * Other endpoints return decomposed results that need to be stacked (outcomes).
   */
  stacked?: boolean;

  /**
   * Function to format tooltip values
   */
  tooltipFormatter?: (value: number) => string;

  /**
   * Whether timestamps are should be shown in UTC or local timezone.
   */
  utc?: boolean;
}

export function getYAxisMaxFn(height: number) {
  return (value: {max: number; min: number}) => {
    // This keeps small datasets from looking 'scary'
    // by having full bars for < 10 values.
    if (value.max < 10) {
      return 10;
    }
    // Adds extra spacing at the top of the chart canvas, ensuring the series doesn't hit the ceiling, leaving more empty space.
    // When the user hovers over an empty space, a tooltip with all series information is displayed.
    return (value.max * (height + 10)) / height;
  };
}

function MiniBarChart({
  emphasisColors,
  series,
  hideDelay,
  tooltipFormatter,
  colors,
  stacked = false,
  labelYAxisExtents = false,
  showMarkLineLabel = false,
  height,
  grid,
  ...props
}: Props) {
  const theme = useTheme();

  const updatedSeries: BarChartSeries[] = useMemo(() => {
    if (!series?.length) {
      return [];
    }

    const chartSeries: BarChartSeries[] = [];

    const colorList = Array.isArray(colors)
      ? colors
      : [theme.gray200, theme.purple300, theme.purple300];

    for (let i = 0; i < series.length; i++) {
      const original = series[i];
      const updated: BarChartSeries = {
        ...original,
        cursor: 'normal',
        type: 'bar',
      };

      if (i === 0) {
        updated.barMinHeight = 1;
        if (stacked === false) {
          updated.barGap = '-100%';
        }
      }
      if (stacked) {
        updated.stack = 'stack1';
      }
      set(updated, 'itemStyle.color', colorList[i]);
      set(updated, 'itemStyle.opacity', 0.6);
      set(updated, 'emphasis.itemStyle.opacity', 1.0);
      set(updated, 'emphasis.itemStyle.color', emphasisColors?.[i] ?? colorList[i]);
      chartSeries.push(updated);
    }
    return chartSeries;
  }, [series, emphasisColors, stacked, colors, theme.gray200, theme.purple300]);

  const chartOptions = useMemo(() => {
    const yAxisOptions = labelYAxisExtents
      ? makeLabelYAxisOptions(tooltipFormatter)
      : noLabelYAxisOptions;

    const options = makeBaseChartOptions({
      height,
      hideDelay,
      tooltipFormatter,
      labelYAxisExtents,
      showMarkLineLabel,
      grid,
      yAxisOptions,
    });

    return options;
  }, [grid, height, hideDelay, labelYAxisExtents, showMarkLineLabel, tooltipFormatter]);

  return <BarChart series={updatedSeries} height={height} {...chartOptions} {...props} />;
}

export default MiniBarChart;
