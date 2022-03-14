// Import to ensure echarts components are loaded.
import './components/markPoint';

import * as React from 'react';
import {useTheme} from '@emotion/react';
import set from 'lodash/set';

import {getFormattedDate} from 'sentry/utils/dates';
import {formatAbbreviatedNumber} from 'sentry/utils/formatters';

import BarChart, {BarChartSeries} from './barChart';
import BaseChart from './baseChart';
import {truncationFormatter} from './utils';

type Marker = {
  color: string;
  name: string;
  value: string | number | Date;
  symbolSize?: number;
};

type ChartProps = React.ComponentProps<typeof BaseChart>;

type BarChartProps = React.ComponentProps<typeof BarChart>;

type Props = Omit<ChartProps, 'css' | 'colors' | 'series' | 'height'> & {
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
   * Delay time for hiding tooltip, in ms.
   */
  hideDelay?: number;

  /**
   * Show max/min values on yAxis
   */
  labelYAxisExtents?: boolean;

  /**
   * A list of series to be rendered as markLine components on the chart
   * This is often used to indicate start/end markers on the xAxis
   */
  markers?: Marker[];

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
};

function MiniBarChart({
  markers,
  emphasisColors,
  series,
  hideDelay,
  tooltipFormatter,
  colors,
  stacked = false,
  labelYAxisExtents = false,
  showMarkLineLabel = false,
  height,
  ...props
}: Props) {
  const {ref: _ref, ...barChartProps} = props;
  const theme = useTheme();
  const colorList = Array.isArray(colors)
    ? colors
    : [theme.gray200, theme.purple300, theme.purple300];

  let chartSeries: BarChartSeries[] = [];

  // Ensure bars overlap and that empty values display as we're disabling the axis lines.
  if (!!series?.length) {
    chartSeries = series.map((original, i: number) => {
      const updated = {
        ...original,
        cursor: 'normal',
        type: 'bar',
      } as BarChartSeries;

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
      set(updated, 'itemStyle.emphasis.opacity', 1.0);
      set(updated, 'itemStyle.emphasis.color', emphasisColors?.[i] ?? colorList[i]);

      return updated;
    });
  }

  if (markers) {
    const markerTooltip = {
      show: true,
      trigger: 'item',
      formatter: ({data}) => {
        const time = getFormattedDate(data.coord[0], 'MMM D, YYYY LT', {
          local: !props.utc,
        });
        const name = truncationFormatter(data.name, props?.xAxis?.truncate);
        return [
          '<div class="tooltip-series">',
          `<div><span class="tooltip-label"><strong>${name}</strong></span></div>`,
          '</div>',
          '<div class="tooltip-date">',
          time,
          '</div>',
          '</div>',
          '<div class="tooltip-arrow"></div>',
        ].join('');
      },
    };

    const markPoint = {
      data: markers.map((marker: Marker) => ({
        name: marker.name,
        coord: [marker.value, 0],
        tooltip: markerTooltip,
        symbol: 'circle',
        symbolSize: marker.symbolSize ?? 8,
        itemStyle: {
          color: marker.color,
          borderColor: theme.background,
        },
      })),
    };
    chartSeries[0].markPoint = markPoint;
  }

  const yAxisOptions = labelYAxisExtents
    ? {
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
      }
    : {
        axisLabel: {
          show: false,
        },
      };

  const chartOptions = {
    tooltip: {
      trigger: 'axis' as const,
      hideDelay,
      valueFormatter: tooltipFormatter
        ? (value: number) => tooltipFormatter(value)
        : undefined,
    },
    yAxis: {
      max(value: {max: number; min: number}) {
        // This keeps small datasets from looking 'scary'
        // by having full bars for < 10 values.
        if (value.max < 10) {
          return 10;
        }
        // Adds extra spacing at the top of the chart canvas, ensuring the series doesn't hit the ceiling, leaving more empty space.
        // When the user hovers over an empty space, a tooltip with all series information is displayed.
        return (value.max * (height + 10)) / height;
      },
      splitLine: {
        show: false,
      },
      ...yAxisOptions,
    },
    grid: {
      // Offset to ensure there is room for the marker symbols at the
      // default size.
      top: labelYAxisExtents || showMarkLineLabel ? 6 : 0,
      bottom: markers || labelYAxisExtents || showMarkLineLabel ? 4 : 0,
      left: markers ? 8 : showMarkLineLabel ? 35 : 4,
      right: markers ? 4 : 0,
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

  return (
    <BarChart series={chartSeries} height={height} {...chartOptions} {...barChartProps} />
  );
}

export default MiniBarChart;
