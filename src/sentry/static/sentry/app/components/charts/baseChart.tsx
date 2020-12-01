import 'zrender/lib/svg/svg';

import React from 'react';
import styled from '@emotion/styled';
import echarts, {EChartOption, ECharts} from 'echarts/lib/echarts';
import ReactEchartsCore from 'echarts-for-react/lib/core';
import {withTheme} from 'emotion-theming';

import {IS_ACCEPTANCE_TEST} from 'app/constants';
import space from 'app/styles/space';
import {
  EChartChartReadyHandler,
  EChartDataZoomHandler,
  EChartEventHandler,
  ReactEchartsRef,
  Series,
} from 'app/types/echarts';
import {Theme} from 'app/utils/theme';

import Grid from './components/grid';
import Legend from './components/legend';
import Tooltip from './components/tooltip';
import XAxis from './components/xAxis';
import YAxis from './components/yAxis';
import LineSeries from './series/lineSeries';

// If dimension is a number convert it to pixels, otherwise use dimension without transform
const getDimensionValue = (dimension?: ReactEChartOpts['height']) => {
  if (typeof dimension === 'number') {
    return `${dimension}px`;
  }

  if (dimension === null) {
    return undefined;
  }

  return dimension;
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

type Props = {
  theme: Theme;

  options?: EChartOption;
  /**
   * Chart Series
   * This is different than the interface to higher level charts, these need to
   * be an array of ECharts "Series" components.
   */
  series?: EChartOption.Series[];
  /**
   * Array of color codes to use in charts
   */
  colors?: string[];
  /**
   * Must be explicitly `null` to disable xAxis
   *
   * Additionally a `truncate` option
   */
  xAxis?: (EChartOption.XAxis & Truncateable) | null;
  /**
   * Must be explicitly `null` to disable yAxis
   */
  yAxis?: EChartOption.YAxis | null;
  /**
   * Pass `true` to have 2 y-axes with default properties. Can pass an array of
   * objects to customize yAxis properties
   */
  yAxes?: true | Props['yAxis'][];
  /**
   * Pass `true` to have 2 x-axes with default properties.  Can pass an array
   * of multiple objects to customize xAxis properties
   */
  xAxes?: true | Props['xAxis'][];
  /**
   * Tooltip options
   */
  tooltip?: EChartOption.Tooltip &
    Truncateable & {
      filter?: (value: number) => boolean;
      formatAxisLabel?: (
        value: number,
        isTimestamp: boolean,
        utc: boolean,
        showTimeInTooltip: boolean
      ) => string;
      valueFormatter?: (value: number, label?: string) => string | number;
      nameFormatter?: (name: string) => string;
    };
  /**
   * DataZoom (allows for zooming of chart)
   */
  dataZoom?: EChartOption['dataZoom'];
  /**
   * Axis pointer options
   */
  axisPointer?: EChartOption.AxisPointer;
  /**
   * Toolbox options
   */
  toolBox?: EChartOption['toolbox'];
  /**
   * Graphic options
   */
  graphic?: EChartOption['graphic'];
  /**
   * ECharts Grid options. multiple grids allow multiple sub-graphs.
   */
  grid?: EChartOption.Grid | EChartOption.Grid[];
  /**
   * Chart legend
   */
  legend?: EChartOption.Legend & Truncateable;
  /**
   * Chart height
   */
  height?: ReactEChartOpts['height'];
  /**
   * Chart width
   */
  width?: ReactEChartOpts['width'];
  /**
   * Use `canvas` when dealing with large datasets
   * See: https://ecomfe.github.io/echarts-doc/public/en/tutorial.html#Render%20by%20Canvas%20or%20SVG
   */
  renderer?: ReactEChartOpts['renderer'];
  devicePixelRatio?: ReactEChartOpts['devicePixelRatio'];
  /**
   * theme name
   * example theme: https://github.com/apache/incubator-echarts/blob/master/theme/dark.js
   */
  echartsTheme?: ReactEchartProps['theme'];
  /**
   * states whether or not to merge with previous `option`
   */
  notMerge?: boolean;
  /**
   * states whether not to update chart immediately
   */
  lazyUpdate?: boolean;
  onChartReady?: EChartChartReadyHandler;
  onHighlight?: EChartEventHandler<any>;
  onMouseOver?: EChartEventHandler<any>;
  onClick?: EChartEventHandler<any>;
  onDataZoom?: EChartDataZoomHandler;
  /**
   * One example of when this is called is restoring chart from zoom levels
   */
  onRestore?: EChartEventHandler<{type: 'restore'}>;
  onFinished?: EChartEventHandler<{}>;
  onRendered?: EChartEventHandler<{}>;
  onLegendSelectChanged?: EChartEventHandler<{}>;
  /**
   * Forwarded Ref
   */
  forwardedRef?: React.Ref<ReactEchartsCore>;
  /**
   * Custom chart props that are implemented by us (and not a feature of eCharts)
   *
   * Display previous period as a LineSeries
   */
  previousPeriod?: Series[];
  /**
   * If data is grouped by date; then apply default date formatting to x-axis
   * and tooltips.
   */
  isGroupedByDate?: boolean;
  /**
   * Format timestamp with date AND time
   */
  showTimeInTooltip?: boolean;
  /**
   * Use short date formatting for xAxis
   */
  useShortDate?: boolean;
  /**
   * optional, used to determine how xAxis is formatted if `isGroupedByDate == true`
   */
  start?: Date;
  /**
   * optional, used to determine how xAxis is formatted if `isGroupedByDate == true`
   */
  end?: Date;
  /**
   * optional, used to determine how xAxis is formatted if `isGroupedByDate == true`
   */
  period?: string;
  /**
   * Formats dates as UTC?
   */
  utc?: boolean;
  /**
   * Bucket size to display time range in chart tooltip
   */
  bucketSize?: number;
  /**
   * If true and there's only one datapoint in series.data, we show a bar chart to increase the visibility.
   * Especially useful with line / area charts, because you can't draw line with single data point and one alone point is hard to spot.
   */
  transformSinglePointToBar?: boolean;
  /**
   * Inline styles
   */
  style?: React.CSSProperties;
};

class BaseChart extends React.Component<Props> {
  static defaultProps = {
    height: 200,
    width: 'auto',
    renderer: 'svg',
    notMerge: true,
    lazyUpdate: false,
    onChartReady: () => {},
    options: {},

    series: [],
    xAxis: {},
    yAxis: {},
    isGroupedByDate: false,
    transformSinglePointToBar: false,
  };

  getEventsMap: ReactEchartProps['onEvents'] = {
    click: (props, instance) => {
      this.handleClick(props, instance);
      this.props.onClick?.(props, instance);
    },
    highlight: (props, instance) => this.props.onHighlight?.(props, instance),
    mouseover: (props, instance) => this.props.onMouseOver?.(props, instance),
    datazoom: (props, instance) => this.props.onDataZoom?.(props, instance),
    restore: (props, instance) => this.props.onRestore?.(props, instance),
    finished: (props, instance) => this.props.onFinished?.(props, instance),
    rendered: (props, instance) => this.props.onRendered?.(props, instance),
    legendselectchanged: (props, instance) =>
      this.props.onLegendSelectChanged?.(props, instance),
  };

  // TODO(ts): What is the series type? EChartOption.Series's data cannot have
  // `onClick` since it's typically an array.
  /**
   * Handle series item clicks (e.g. Releases mark line or a single series item)
   * This is different than when you hover over an "axis" line on a chart (e.g.
   * if there are 2 series for an axis and you're not directly hovered over an item)
   *
   * Calls "onClick" inside of series data
   */
  handleClick = (series: any, instance: ECharts) => {
    if (series.data) {
      series.data.onClick?.(series, instance);
    }
  };

  getColorPalette() {
    const {theme, series} = this.props;

    const palette = series?.length
      ? theme.charts.getColorPalette(series.length)
      : theme.charts.colors;

    return (palette as unknown) as string[];
  }

  getSeries() {
    const {previousPeriod, series, theme, transformSinglePointToBar} = this.props;

    const hasSinglePoints = (series as EChartOption.SeriesLine[] | undefined)?.every(
      s => Array.isArray(s.data) && s.data.length === 1
    );

    const transformedSeries =
      (hasSinglePoints && transformSinglePointToBar
        ? (series as EChartOption.SeriesLine[] | undefined)?.map(s => ({
            ...s,
            type: 'bar',
            barWidth: 40,
            barGap: 0,
          }))
        : series) ?? [];

    const transformedPreviousPeriod =
      previousPeriod?.map(previous =>
        LineSeries({
          name: previous.seriesName,
          data: previous.data.map(({name, value}) => [name, value]),
          lineStyle: {
            color: theme.gray200,
            type: 'dotted',
          },
          itemStyle: {
            color: theme.gray200,
          },
        })
      ) ?? [];

    if (!previousPeriod) {
      return transformedSeries;
    }

    return [...transformedSeries, ...transformedPreviousPeriod];
  }

  render() {
    const {
      theme,

      options,
      colors,
      grid,
      tooltip,
      legend,
      series,
      yAxis,
      xAxis,
      dataZoom,
      toolBox,
      graphic,
      axisPointer,

      isGroupedByDate,
      showTimeInTooltip,
      useShortDate,
      start,
      end,
      period,
      utc,
      yAxes,
      xAxes,

      devicePixelRatio,
      height,
      width,
      renderer,
      notMerge,
      lazyUpdate,
      style,
      forwardedRef,
      onChartReady,
    } = this.props;

    const defaultAxesProps = {theme};
    const yAxisOrCustom = !yAxes
      ? yAxis !== null
        ? YAxis({theme, ...yAxis})
        : undefined
      : Array.isArray(yAxes)
      ? yAxes.map(axis => YAxis({...axis, theme}))
      : [YAxis(defaultAxesProps), YAxis(defaultAxesProps)];
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
            utc,
          })
        : undefined
      : Array.isArray(xAxes)
      ? xAxes.map(axis =>
          XAxis({...axis, theme, useShortDate, start, end, period, isGroupedByDate, utc})
        )
      : [XAxis(defaultAxesProps), XAxis(defaultAxesProps)];

    // Maybe changing the series type to types/echarts Series[] would be a better solution
    // and can't use ignore for multiline blocks
    // @ts-expect-error
    const seriesValid = series && series[0]?.data && series[0].data.length > 1;
    // @ts-expect-error
    const seriesData = seriesValid ? series[0].data : undefined;
    const bucketSize = seriesData ? seriesData[1][0] - seriesData[0][0] : undefined;

    return (
      <ChartContainer>
        <ReactEchartsCore
          ref={forwardedRef}
          echarts={echarts}
          notMerge={notMerge}
          lazyUpdate={lazyUpdate}
          theme={this.props.echartsTheme}
          onChartReady={onChartReady}
          onEvents={this.getEventsMap}
          opts={{
            height,
            width,
            renderer,
            devicePixelRatio,
          }}
          style={{
            height: getDimensionValue(height),
            width: getDimensionValue(width),
            ...style,
          }}
          option={{
            animation: IS_ACCEPTANCE_TEST ? false : true,
            ...options,
            useUTC: utc,
            color: colors || this.getColorPalette(),
            grid: Array.isArray(grid) ? grid.map(Grid) : Grid(grid),
            tooltip:
              tooltip !== null
                ? Tooltip({
                    showTimeInTooltip,
                    isGroupedByDate,
                    utc,
                    bucketSize,
                    ...tooltip,
                  })
                : undefined,
            legend: legend ? Legend({...legend}) : undefined,
            yAxis: yAxisOrCustom,
            xAxis: xAxisOrCustom,
            series: this.getSeries(),
            axisPointer,
            dataZoom,
            toolbox: toolBox,
            graphic,
          }}
        />
      </ChartContainer>
    );
  }
}

// Contains styling for chart elements as we can't easily style those
// elements directly
const ChartContainer = styled('div')`
  /* Tooltip styling */
  .tooltip-series,
  .tooltip-date {
    color: ${p => p.theme.gray300};
    font-family: ${p => p.theme.text.family};
    background: ${p => p.theme.gray500};
    padding: ${space(1)} ${space(2)};
    border-radius: ${p => p.theme.borderRadius} ${p => p.theme.borderRadius} 0 0;
  }
  .tooltip-series-solo {
    border-radius: ${p => p.theme.borderRadius};
  }
  .tooltip-label {
    margin-right: ${space(1)};
  }
  .tooltip-label strong {
    font-weight: normal;
    color: ${p => p.theme.white};
  }
  .tooltip-series > div {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
  }
  .tooltip-date {
    border-top: 1px solid ${p => p.theme.gray400};
    text-align: center;
    position: relative;
    width: auto;
    border-radius: ${p => p.theme.borderRadiusBottom};
  }
  .tooltip-arrow {
    top: 100%;
    left: 50%;
    border: 0px solid transparent;
    content: ' ';
    height: 0;
    width: 0;
    position: absolute;
    pointer-events: none;
    border-top-color: ${p => p.theme.gray500};
    border-width: 8px;
    margin-left: -8px;
  }

  .echarts-for-react div:first-of-type {
    width: 100% !important;
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
    max-width: 250px;
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

const BaseChartWithTheme = withTheme(BaseChart);

const BaseChartRef = React.forwardRef<ReactEchartsRef, Omit<Props, 'theme'>>(
  (props, ref) => <BaseChartWithTheme forwardedRef={ref} {...props} />
);
BaseChartRef.displayName = 'forwardRef(BaseChart)';

export default BaseChartRef;
