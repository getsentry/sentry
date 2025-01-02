// Import to ensure echarts components are loaded.
import './components/markPoint';

import {useMemo} from 'react';
import {useTheme} from '@emotion/react';
import type {GridComponentOption} from 'echarts';
import set from 'lodash/set';

import {formatAbbreviatedNumber} from 'sentry/utils/formatters';

import type {BarChartProps, BarChartSeries} from './barChart';
import {BarChart} from './barChart';
import type {BaseChartProps} from './baseChart';

function makeBaseChartOptions({
  animateBars,
  height,
  hideDelay,
  tooltipFormatter,
  labelYAxisExtents,
  showMarkLineLabel,
  markLineLabelSide,
  grid,
  yAxisOptions,
  showXAxisLine,
  xAxisLineColor,
}: {
  animateBars: boolean;
  height: number;
  markLineLabelSide: 'right' | 'left';
  showXAxisLine: boolean;
  xAxisLineColor: string;
  grid?: GridComponentOption;
  hideDelay?: number;
  labelYAxisExtents?: boolean;
  showMarkLineLabel?: boolean;
  tooltipFormatter?: (value: number) => string;
  yAxisOptions?: BarChartProps['yAxis'];
}): Omit<BarChartProps, 'series' | 'barOpacity'> {
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
      left: markLineLabelSide === 'left' ? (showMarkLineLabel ? 35 : 4) : 0,
      right: markLineLabelSide === 'right' ? (showMarkLineLabel ? 25 : 4) : 0,
    },
    xAxis: {
      axisLine: showXAxisLine
        ? {
            show: true,
            lineStyle: {
              color: xAxisLineColor,
            },
            onZero: false, // Enables offset for x-axis line
          }
        : {show: false},
      axisTick: {
        show: false,
        alignWithLabel: true,
      },
      offset: showXAxisLine ? -1 : 0,
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
    options: animateBars
      ? {
          animation: true,
          animationEasing: 'circularOut',
        }
      : {
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
   * Whether to animate the bars on initial render.
   * If true, bars will rise from the x-axis to their final height.
   */
  animateBars?: boolean;

  /**
   * Opacity of each bar in the graph (0-1)
   */
  barOpacity?: number;

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
   * Whether to hide the bar for zero values in the chart.
   */
  hideZeros?: boolean;

  /**
   * Show max/min values on yAxis
   */
  labelYAxisExtents?: boolean;

  /**
   * Which side of the chart the mark line label shows on.
   * Requires `showMarkLineLabel` to be true.
   */
  markLineLabelSide?: 'right' | 'left';

  /**
   * Series data to display
   */
  series?: BarChartProps['series'];

  /**
   * Whether not we show a MarkLine label
   */
  showMarkLineLabel?: boolean;

  /**
   * Whether or not to show the x-axis line
   */
  showXAxisLine?: boolean;

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
  animateBars = false,
  barOpacity = 0.6,
  emphasisColors,
  series,
  hideDelay,
  hideZeros = false,
  tooltipFormatter,
  colors,
  stacked = false,
  labelYAxisExtents = false,
  showMarkLineLabel = false,
  markLineLabelSide = 'left',
  showXAxisLine = false,
  height,
  grid,
  ...props
}: Props) {
  const theme = useTheme();
  const xAxisLineColor: string = theme.gray200;
  const updatedSeries: BarChartSeries[] = useMemo(() => {
    if (!series?.length) {
      return [];
    }

    const chartSeries: BarChartSeries[] = [];

    const colorList = Array.isArray(colors)
      ? colors
      : [theme.gray200, theme.purple300, theme.purple300];

    for (let i = 0; i < series.length; i++) {
      const original = series[i]!;
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
      set(updated, 'itemStyle.borderRadius', [1, 1, 0, 0]); // Rounded corners on top of the bar
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
      animateBars,
      height,
      hideDelay,
      tooltipFormatter,
      labelYAxisExtents,
      showMarkLineLabel,
      markLineLabelSide,
      grid,
      yAxisOptions,
      showXAxisLine,
      xAxisLineColor,
    });

    return options;
  }, [
    animateBars,
    grid,
    height,
    hideDelay,
    labelYAxisExtents,
    markLineLabelSide,
    showMarkLineLabel,
    showXAxisLine,
    tooltipFormatter,
    xAxisLineColor,
  ]);

  return (
    <BarChart
      barOpacity={barOpacity}
      hideZeros={hideZeros}
      series={updatedSeries}
      height={height}
      {...chartOptions}
      {...props}
    />
  );
}

export default MiniBarChart;
