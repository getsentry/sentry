import 'echarts/lib/component/grid';
import 'echarts/lib/component/graphic';
import 'echarts/lib/component/toolbox';
import 'zrender/lib/svg/svg';

import {forwardRef, useMemo} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import type {
  AxisPointerComponentOption,
  ECharts,
  EChartsOption,
  GridComponentOption,
  LegendComponentOption,
  LineSeriesOption,
  SeriesOption,
  TooltipComponentFormatterCallback,
  TooltipComponentFormatterCallbackParams,
  TooltipComponentOption,
  VisualMapComponentOption,
  XAXisComponentOption,
  YAXisComponentOption,
} from 'echarts';
import * as echarts from 'echarts/core';
import ReactEchartsCore from 'echarts-for-react/lib/core';

import MarkLine from 'sentry/components/charts/components/markLine';
import {IS_ACCEPTANCE_TEST} from 'sentry/constants';
import space from 'sentry/styles/space';
import {
  EChartChartReadyHandler,
  EChartClickHandler,
  EChartDataZoomHandler,
  EChartEventHandler,
  EChartFinishedHandler,
  EChartHighlightHandler,
  EChartMouseOverHandler,
  EChartRenderedHandler,
  EChartRestoreHandler,
  ReactEchartsRef,
  Series,
} from 'sentry/types/echarts';
import {defined} from 'sentry/utils';
import type {Theme} from 'sentry/utils/theme';

import Grid from './components/grid';
import Legend from './components/legend';
import Tooltip from './components/tooltip';
import XAxis from './components/xAxis';
import YAxis from './components/yAxis';
import LineSeries from './series/lineSeries';
import {getDiffInMinutes, getDimensionValue, lightenHexToRgb} from './utils';

// TODO(ts): What is the series type? EChartOption.Series's data cannot have
// `onClick` since it's typically an array.
//
// Handle series item clicks (e.g. Releases mark line or a single series
// item) This is different than when you hover over an "axis" line on a chart
// (e.g.  if there are 2 series for an axis and you're not directly hovered
// over an item)
//
// Calls "onClick" inside of series data
const handleClick = (clickSeries: any, instance: ECharts) => {
  if (clickSeries.data) {
    clickSeries.data.onClick?.(clickSeries, instance);
  }
};

type ReactEchartProps = React.ComponentProps<typeof ReactEchartsCore>;
type ReactEChartOpts = NonNullable<ReactEchartProps['opts']>;

/**
 * Used for some properties that can be truncated
 */
type Truncateable = {
  /**
   * Truncate the label / value some number of characters.
   * If true is passed, it will use truncate based on a default length.
   */
  truncate?: number | boolean;
};

interface TooltipOption
  extends Omit<TooltipComponentOption, 'valueFormatter'>,
    Truncateable {
  filter?: (value: number, seriesParam: TooltipComponentOption['formatter']) => boolean;
  formatAxisLabel?: (
    value: number,
    isTimestamp: boolean,
    utc: boolean,
    showTimeInTooltip: boolean,
    addSecondsToTimeFormat: boolean,
    bucketSize: number | undefined,
    seriesParamsOrParam: TooltipComponentFormatterCallbackParams
  ) => string;
  /**
   * Array containing seriesNames that need to be indented
   */
  indentLabels?: string[];
  markerFormatter?: (marker: string, label?: string) => string;
  nameFormatter?: (name: string) => string;
  valueFormatter?: (
    value: number,
    label?: string,
    seriesParams?: TooltipComponentFormatterCallback<any>
  ) => string;
}

type Props = {
  /**
   * Additional Chart Series
   * This is to pass series to BaseChart bypassing the wrappers like LineChart, AreaChart etc.
   */
  additionalSeries?: LineSeriesOption[];
  /**
   * If true, ignores height value and auto-scales chart to fit container height.
   */
  autoHeightResize?: boolean;
  /**
   * Axis pointer options
   */
  axisPointer?: AxisPointerComponentOption;
  /**
   * Bucket size to display time range in chart tooltip
   */
  bucketSize?: number;
  /**
   * Array of color codes to use in charts. May also take a function which is
   * provided with the current theme
   */
  colors?: string[] | ((theme: Theme) => string[]);
  /**
   * DataZoom (allows for zooming of chart)
   */
  dataZoom?: EChartsOption['dataZoom'];
  devicePixelRatio?: ReactEChartOpts['devicePixelRatio'];
  /**
   * theme name
   * example theme: https://github.com/apache/incubator-echarts/blob/master/theme/dark.js
   */
  echartsTheme?: ReactEchartProps['theme'];
  /**
   * optional, used to determine how xAxis is formatted if `isGroupedByDate == true`
   */
  end?: Date;
  /**
   * Forwarded Ref
   */
  forwardedRef?: React.Ref<ReactEchartsCore>;
  /**
   * Graphic options
   */
  graphic?: EChartsOption['graphic'];
  /**
   * ECharts Grid options. multiple grids allow multiple sub-graphs.
   */
  grid?: GridComponentOption | GridComponentOption[];
  /**
   * Chart height
   */
  height?: ReactEChartOpts['height'];
  /**
   * If data is grouped by date; then apply default date formatting to x-axis
   * and tooltips.
   */
  isGroupedByDate?: boolean;
  /**
   * states whether not to update chart immediately
   */
  lazyUpdate?: boolean;
  /**
   * Chart legend
   */
  legend?: LegendComponentOption & Truncateable;
  /**
   * optional, threshold in minutes used to add seconds to the xAxis datetime format if `isGroupedByDate == true`
   */
  minutesThresholdToDisplaySeconds?: number;
  /**
   * states whether or not to merge with previous `option`
   */
  notMerge?: boolean;
  onChartReady?: EChartChartReadyHandler;
  onClick?: EChartClickHandler;
  onDataZoom?: EChartDataZoomHandler;
  onFinished?: EChartFinishedHandler;
  onHighlight?: EChartHighlightHandler;
  onLegendSelectChanged?: EChartEventHandler<{
    name: string;
    selected: Record<string, boolean>;
    type: 'legendselectchanged';
  }>;
  onMouseOver?: EChartMouseOverHandler;
  onRendered?: EChartRenderedHandler;
  /**
   * One example of when this is called is restoring chart from zoom levels
   */
  onRestore?: EChartRestoreHandler;
  options?: EChartsOption;
  /**
   * optional, used to determine how xAxis is formatted if `isGroupedByDate == true`
   */
  period?: string | null;
  /**
   * Custom chart props that are implemented by us (and not a feature of eCharts)
   *
   * Display previous period as a LineSeries
   */
  previousPeriod?: Series[];
  /**
   * Use `canvas` when dealing with large datasets
   * See: https://ecomfe.github.io/echarts-doc/public/en/tutorial.html#Render%20by%20Canvas%20or%20SVG
   */
  renderer?: ReactEChartOpts['renderer'];
  /**
   * Chart Series
   * This is different than the interface to higher level charts, these need to
   * be an array of ECharts "Series" components.
   */
  series?: SeriesOption[];
  /**
   * Format timestamp with date AND time
   */
  showTimeInTooltip?: boolean;
  /**
   * optional, used to determine how xAxis is formatted if `isGroupedByDate == true`
   */
  start?: Date;
  /**
   * Inline styles
   */
  style?: React.CSSProperties;
  /**
   * Toolbox options
   */
  toolBox?: EChartsOption['toolbox'];
  /**
   * Tooltip options
   */
  tooltip?: TooltipOption;
  /**
   * If true and there's only one datapoint in series.data, we show a bar chart to increase the visibility.
   * Especially useful with line / area charts, because you can't draw line with single data point and one alone point is hard to spot.
   */
  transformSinglePointToBar?: boolean;
  /**
   * If true and there's only one datapoint in series.data, we show a horizontal line to increase the visibility
   * Similarly to single point bar in area charts a flat line for line charts makes it easy to spot the single data point.
   */
  transformSinglePointToLine?: boolean;
  /**
   * Use short date formatting for xAxis
   */
  useShortDate?: boolean;
  /**
   * Formats dates as UTC?
   */
  utc?: boolean;
  /**
   * ECharts Visual Map Options.
   */
  visualMap?: VisualMapComponentOption | VisualMapComponentOption[];
  /**
   * Chart width
   */
  width?: ReactEChartOpts['width'];
  /**
   * Pass `true` to have 2 x-axes with default properties.  Can pass an array
   * of multiple objects to customize xAxis properties
   */
  xAxes?: true | Props['xAxis'][];
  /**
   * Must be explicitly `null` to disable xAxis
   *
   * Additionally a `truncate` option
   */
  xAxis?: (XAXisComponentOption & Truncateable) | null;
  /**
   * Pass `true` to have 2 y-axes with default properties. Can pass an array of
   * objects to customize yAxis properties
   */
  yAxes?: true | Props['yAxis'][];

  /**
   * Must be explicitly `null` to disable yAxis
   */
  yAxis?: YAXisComponentOption | null;
};

function BaseChartUnwrapped({
  colors,
  grid,
  tooltip,
  legend,
  dataZoom,
  toolBox,
  graphic,
  axisPointer,
  previousPeriod,
  echartsTheme,
  devicePixelRatio,

  minutesThresholdToDisplaySeconds,
  showTimeInTooltip,
  useShortDate,
  start,
  end,
  period,
  utc,
  yAxes,
  xAxes,

  style,
  forwardedRef,

  onClick,
  onLegendSelectChanged,
  onHighlight,
  onMouseOver,
  onDataZoom,
  onRestore,
  onFinished,
  onRendered,

  options = {},
  series = [],
  additionalSeries = [],
  yAxis = {},
  xAxis = {},

  autoHeightResize = false,
  height = 200,
  width = 'auto',
  renderer = 'svg',
  notMerge = true,
  lazyUpdate = false,
  isGroupedByDate = false,
  transformSinglePointToBar = false,
  transformSinglePointToLine = false,
  onChartReady = () => {},
}: Props) {
  const theme = useTheme();

  const hasSinglePoints = (series as LineSeriesOption[] | undefined)?.every(
    s => Array.isArray(s.data) && s.data.length <= 1
  );

  const resolveColors =
    colors !== undefined ? (Array.isArray(colors) ? colors : colors(theme)) : null;
  const color =
    resolveColors ||
    (series.length ? theme.charts.getColorPalette(series.length) : theme.charts.colors);
  const previousPeriodColors =
    previousPeriod && previousPeriod.length > 1 ? lightenHexToRgb(color) : undefined;

  const transformedSeries =
    (hasSinglePoints && transformSinglePointToBar
      ? (series as LineSeriesOption[] | undefined)?.map(s => ({
          ...s,
          type: 'bar',
          barWidth: 40,
          barGap: 0,
          itemStyle: {...(s.areaStyle ?? {})},
        }))
      : hasSinglePoints && transformSinglePointToLine
      ? (series as LineSeriesOption[] | undefined)?.map(s => ({
          ...s,
          type: 'line',
          itemStyle: {...(s.lineStyle ?? {})},
          markLine:
            s?.data?.[0]?.[1] !== undefined
              ? MarkLine({
                  silent: true,
                  lineStyle: {
                    type: 'solid',
                    width: 1.5,
                  },
                  data: [{yAxis: s?.data?.[0]?.[1]}],
                  label: {
                    show: false,
                  },
                })
              : undefined,
        }))
      : series) ?? [];

  const transformedPreviousPeriod =
    previousPeriod?.map((previous, seriesIndex) =>
      LineSeries({
        name: previous.seriesName,
        data: previous.data.map(({name, value}) => [name, value]),
        lineStyle: {
          color: previousPeriodColors ? previousPeriodColors[seriesIndex] : theme.gray200,
          type: 'dotted',
        },
        itemStyle: {
          color: previousPeriodColors ? previousPeriodColors[seriesIndex] : theme.gray200,
        },
        stack: 'previous',
        animation: false,
      })
    ) ?? [];

  const resolvedSeries = !previousPeriod
    ? [...transformedSeries, ...additionalSeries]
    : [...transformedSeries, ...transformedPreviousPeriod, ...additionalSeries];

  const defaultAxesProps = {theme};

  const yAxisOrCustom = !yAxes
    ? yAxis !== null
      ? YAxis({theme, ...yAxis})
      : undefined
    : Array.isArray(yAxes)
    ? yAxes.map(axis => YAxis({...axis, theme}))
    : [YAxis(defaultAxesProps), YAxis(defaultAxesProps)];

  /**
   * If true seconds will be added to the time format in the tooltips and chart xAxis
   */
  const addSecondsToTimeFormat =
    isGroupedByDate && defined(minutesThresholdToDisplaySeconds)
      ? getDiffInMinutes({start, end, period}) <= minutesThresholdToDisplaySeconds
      : false;

  const xAxisOrCustom = !xAxes
    ? xAxis !== null
      ? XAxis({
          ...xAxis,
          theme,
          useShortDate,
          start,
          end,
          period,
          isGroupedByDate,
          addSecondsToTimeFormat,
          utc,
        })
      : undefined
    : Array.isArray(xAxes)
    ? xAxes.map(axis =>
        XAxis({
          ...axis,
          theme,
          useShortDate,
          start,
          end,
          period,
          isGroupedByDate,
          addSecondsToTimeFormat,
          utc,
        })
      )
    : [XAxis(defaultAxesProps), XAxis(defaultAxesProps)];

  const seriesData =
    Array.isArray(series?.[0]?.data) && series[0].data.length > 1
      ? series[0].data
      : undefined;
  const bucketSize = seriesData ? seriesData[1][0] - seriesData[0][0] : undefined;

  const tooltipOrNone =
    tooltip !== null
      ? Tooltip({
          showTimeInTooltip,
          isGroupedByDate,
          addSecondsToTimeFormat,
          utc,
          bucketSize,
          ...tooltip,
        })
      : undefined;

  const chartOption = {
    ...options,
    animation: IS_ACCEPTANCE_TEST ? false : options.animation ?? true,
    useUTC: utc,
    color,
    grid: Array.isArray(grid) ? grid.map(Grid) : Grid(grid),
    tooltip: tooltipOrNone,
    legend: legend ? Legend({theme, ...legend}) : undefined,
    yAxis: yAxisOrCustom,
    xAxis: xAxisOrCustom,
    series: resolvedSeries,
    toolbox: toolBox,
    axisPointer,
    dataZoom,
    graphic,
  };

  const chartStyles = {
    height: autoHeightResize ? '100%' : getDimensionValue(height),
    width: getDimensionValue(width),
    ...style,
  };

  // XXX(epurkhiser): Echarts can become unhappy if one of these event handlers
  // causes the chart to re-render and be passed a whole different instance of
  // event handlers.
  //
  // We use React.useMemo to keep the value across renders
  //
  const eventsMap = useMemo(
    () =>
      ({
        click: (props, instance) => {
          handleClick(props, instance);
          onClick?.(props, instance);
        },
        highlight: (props, instance) => onHighlight?.(props, instance),
        mouseover: (props, instance) => onMouseOver?.(props, instance),
        datazoom: (props, instance) => onDataZoom?.(props, instance),
        restore: (props, instance) => onRestore?.(props, instance),
        finished: (props, instance) => onFinished?.(props, instance),
        rendered: (props, instance) => onRendered?.(props, instance),
        legendselectchanged: (props, instance) =>
          onLegendSelectChanged?.(props, instance),
      } as ReactEchartProps['onEvents']),
    [onclick, onHighlight, onMouseOver, onDataZoom, onRestore, onFinished, onRendered]
  );

  return (
    <ChartContainer autoHeightResize={autoHeightResize}>
      <ReactEchartsCore
        ref={forwardedRef}
        echarts={echarts}
        notMerge={notMerge}
        lazyUpdate={lazyUpdate}
        theme={echartsTheme}
        onChartReady={onChartReady}
        onEvents={eventsMap}
        style={chartStyles}
        opts={{
          height: autoHeightResize ? 'auto' : height,
          width,
          renderer,
          devicePixelRatio,
        }}
        option={chartOption}
      />
    </ChartContainer>
  );
}

// Contains styling for chart elements as we can't easily style those
// elements directly
const ChartContainer = styled('div')<{autoHeightResize: boolean}>`
  ${p => p.autoHeightResize && 'height: 100%;'}

  /* Tooltip styling */
  .tooltip-series,
  .tooltip-date {
    color: ${p => p.theme.subText};
    font-family: ${p => p.theme.text.family};
    font-variant-numeric: tabular-nums;
    padding: ${space(1)} ${space(2)};
    border-radius: ${p => p.theme.borderRadius} ${p => p.theme.borderRadius} 0 0;
  }
  .tooltip-series {
    border-bottom: none;
  }
  .tooltip-series-solo {
    border-radius: ${p => p.theme.borderRadius};
  }
  .tooltip-label {
    margin-right: ${space(1)};
  }
  .tooltip-label strong {
    font-weight: normal;
    color: ${p => p.theme.textColor};
  }
  .tooltip-label-indent {
    margin-left: ${space(3)};
  }
  .tooltip-series > div {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
  }
  .tooltip-date {
    border-top: solid 1px ${p => p.theme.innerBorder};
    text-align: center;
    position: relative;
    width: auto;
    border-radius: ${p => p.theme.borderRadiusBottom};
  }
  .tooltip-arrow {
    top: 100%;
    left: 50%;
    position: absolute;
    pointer-events: none;
    border-left: 8px solid transparent;
    border-right: 8px solid transparent;
    border-top: 8px solid ${p => p.theme.backgroundElevated};
    margin-left: -8px;
    &:before {
      border-left: 8px solid transparent;
      border-right: 8px solid transparent;
      border-top: 8px solid ${p => p.theme.translucentBorder};
      content: '';
      display: block;
      position: absolute;
      top: -7px;
      left: -8px;
      z-index: -1;
    }
  }

  .echarts-for-react div:first-of-type {
    width: 100% !important;
  }

  .echarts-for-react text {
    font-variant-numeric: tabular-nums !important;
  }

  /* Tooltip description styling */
  .tooltip-description {
    color: ${p => p.theme.white};
    border-radius: ${p => p.theme.borderRadius};
    background: #000;
    opacity: 0.9;
    padding: 5px 10px;
    position: relative;
    font-weight: bold;
    font-size: ${p => p.theme.fontSizeSmall};
    line-height: 1.4;
    font-family: ${p => p.theme.text.family};
    max-width: 230px;
    min-width: 230px;
    white-space: normal;
    text-align: center;
    :after {
      content: '';
      position: absolute;
      top: 100%;
      left: 50%;
      width: 0;
      height: 0;
      border-left: 5px solid transparent;
      border-right: 5px solid transparent;
      border-top: 5px solid #000;
      transform: translateX(-50%);
    }
  }
`;

const BaseChart = forwardRef<ReactEchartsRef, Props>((props, ref) => (
  <BaseChartUnwrapped forwardedRef={ref} {...props} />
));

BaseChart.displayName = 'forwardRef(BaseChart)';

export default BaseChart;
