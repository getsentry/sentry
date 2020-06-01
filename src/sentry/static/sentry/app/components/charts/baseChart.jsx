import 'zrender/lib/svg/svg';

import PropTypes from 'prop-types';
import React from 'react';
import ReactEchartsCore from 'echarts-for-react/lib/core';
import echarts from 'echarts/lib/echarts';
import styled from '@emotion/styled';

import {callIfFunction} from 'app/utils/callIfFunction';
import SentryTypes from 'app/sentryTypes';
import space from 'app/styles/space';
import theme from 'app/utils/theme';

import Grid from './components/grid';
import Legend from './components/legend';
import LineSeries from './series/lineSeries';
import Tooltip from './components/tooltip';
import XAxis from './components/xAxis';
import YAxis from './components/yAxis';

// If dimension is a number convert it to pixels, otherwise use dimension without transform
const getDimensionValue = dimension => {
  if (typeof dimension === 'number') {
    return `${dimension}px`;
  }

  return dimension;
};

class BaseChart extends React.Component {
  static propTypes = {
    // TODO: Pull out props from generic `options` object
    //       so that we can better document them in prop types
    //       see: https://ecomfe.github.io/echarts-doc/public/en/option.html
    //
    // NOTE: [!!] If you use an option that requires a specific echart module,
    //       you WILL NEED to IMPORT that module to have it registered in
    //       echarts. IT WILL FAIL SILENTLY IF YOU DONT.
    options: PropTypes.object,

    // Chart Series
    // This is different than the interface to higher level charts, these need to be
    // an array of ECharts "Series" components.
    series: SentryTypes.EChartsSeries,

    // Array of color codes to use in charts
    colors: PropTypes.arrayOf(PropTypes.string),

    // Must be explicitly `null` to disable xAxis
    xAxis: SentryTypes.EChartsXAxis,

    // Must be explicitly `null` to disable yAxis
    yAxis: SentryTypes.EChartsYAxis,

    // Pass `true` to have 2 y-axes with default properties
    // Can pass an array of objects to customize yAxis properties
    yAxes: PropTypes.oneOfType([
      PropTypes.bool,
      PropTypes.arrayOf(SentryTypes.EChartsYAxis),
    ]),

    // Pass `true` to have 2 x-axes with default properties
    // Can pass an array of multiple objects to customize xAxis properties
    xAxes: PropTypes.oneOfType([
      PropTypes.bool,
      PropTypes.arrayOf(SentryTypes.EChartsXAxis),
    ]),

    // Tooltip options
    tooltip: SentryTypes.EChartsTooltip,

    // DataZoom (allows for zooming of chart)
    dataZoom: PropTypes.oneOfType([
      SentryTypes.EChartsDataZoom,
      PropTypes.arrayOf(SentryTypes.EChartsDataZoom),
    ]),

    // Axis pointer options
    axisPointer: SentryTypes.EChartsAxisPointer,

    toolBox: SentryTypes.EChartsToolBox,

    graphic: SentryTypes.EchartsGraphic,

    // ECharts Grid options
    // multiple grids allow multiple sub-graphs.
    grid: PropTypes.oneOfType([
      SentryTypes.EChartsGrid,
      PropTypes.arrayOf(SentryTypes.EChartsGrid),
    ]),

    // Chart legend
    legend: SentryTypes.EChartsLegend,

    // Chart height
    height: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),

    // Chart width
    width: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),

    // Use `canvas` when dealing with large datasets
    // See: https://ecomfe.github.io/echarts-doc/public/en/tutorial.html#Render%20by%20Canvas%20or%20SVG
    renderer: PropTypes.oneOf(['canvas', 'svg']),

    devicePixelRatio: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),

    // theme name
    // example theme: https://github.com/apache/incubator-echarts/blob/master/theme/dark.js
    theme: PropTypes.string,

    // states whether or not to merge with previous `option`
    notMerge: PropTypes.bool,

    // states whether not to prevent triggering events when calling setOption
    silent: PropTypes.bool,

    // states whether not to update chart immediately
    lazyUpdate: PropTypes.bool,

    // eCharts Event Handlers
    // callback when chart is ready
    onChartReady: PropTypes.func,
    onHighlight: PropTypes.func,
    onMouseOver: PropTypes.func,
    onClick: PropTypes.func,

    // Zoom on chart
    onDataZoom: PropTypes.func,

    // One example of when this is called is restoring chart from zoom levels
    onRestore: PropTypes.func,

    onFinished: PropTypes.func,

    // Forwarded Ref
    forwardedRef: PropTypes.oneOfType([PropTypes.object, PropTypes.func]),

    // Custom chart props that are implemented by us (and not a feature of eCharts)
    /**
     * Display previous period as a LineSeries
     */
    previousPeriod: PropTypes.arrayOf(SentryTypes.SeriesUnit),

    // If data is grouped by date, then apply default date formatting to
    // x-axis and tooltips.
    isGroupedByDate: PropTypes.bool,

    /**
     * Format timestamp with date AND time
     */
    showTimeInTooltip: PropTypes.bool,

    // Use short date formatting for xAxis
    useShortDate: PropTypes.bool,

    // These are optional and are used to determine how xAxis is formatted
    // if `isGroupedByDate == true`
    start: PropTypes.instanceOf(Date),
    end: PropTypes.instanceOf(Date),
    period: PropTypes.string,

    // Formats dates as UTC?
    utc: PropTypes.bool,
  };

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
  };

  getEventsMap = {
    click: (...args) => {
      this.handleClick(...args);
      callIfFunction(this.props.onClick, ...args);
    },
    highlight: (...args) => callIfFunction(this.props.onHighlight, ...args),
    mouseover: (...args) => callIfFunction(this.props.onMouseOver, ...args),
    datazoom: (...args) => callIfFunction(this.props.onDataZoom, ...args),
    restore: (...args) => callIfFunction(this.props.onRestore, ...args),
    finished: (...args) => callIfFunction(this.props.onFinished, ...args),
  };

  handleChartReady = (...args) => {
    const {onChartReady} = this.props;
    onChartReady(...args);
  };

  /**
   * Handle series item clicks (e.g. Releases mark line or a single series item)
   * This is different than when you hover over an "axis" line on a chart (e.g.
   * if there are 2 series for an axis and you're not directly hovered over an item)
   *
   * Calls "onClick" inside of series data
   */
  handleClick = (series, chart) => {
    if (series.data) {
      callIfFunction(series.data.onClick, series, chart);
    }
  };

  getColorPalette = () => {
    const {series} = this.props;

    return series && series.length
      ? theme.charts.getColorPalette(series.length)
      : theme.charts.colors;
  };

  render() {
    const {
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
      previousPeriod,
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
      silent,
      style,
      forwardedRef,
    } = this.props;

    const yAxisOrCustom = !yAxes
      ? yAxis !== null
        ? YAxis(yAxis)
        : null
      : Array.isArray(yAxes)
      ? yAxes.map(YAxis)
      : [YAxis(), YAxis()];
    const xAxisOrCustom = !xAxes
      ? xAxis !== null
        ? XAxis({
            ...xAxis,
            useShortDate,
            start,
            end,
            period,
            isGroupedByDate,
            utc,
          })
        : null
      : Array.isArray(xAxes)
      ? xAxes.map(axis =>
          XAxis({...axis, useShortDate, start, end, period, isGroupedByDate, utc})
        )
      : [XAxis(), XAxis()];

    return (
      <ChartContainer>
        <ReactEchartsCore
          ref={forwardedRef}
          echarts={echarts}
          notMerge={notMerge}
          lazyUpdate={lazyUpdate}
          silent={silent}
          theme={this.props.theme}
          onChartReady={this.handleChartReady}
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
            ...options,
            useUTC: utc,
            color: colors || this.getColorPalette(),
            grid: Array.isArray(grid) ? grid.map(Grid) : Grid(grid),
            tooltip:
              tooltip !== null
                ? Tooltip({showTimeInTooltip, isGroupedByDate, utc, ...tooltip})
                : null,
            legend: legend ? Legend({...legend}) : null,
            yAxis: yAxisOrCustom,
            xAxis: xAxisOrCustom,
            series: !previousPeriod
              ? series
              : [
                  ...series,
                  ...previousPeriod.map(previous =>
                    LineSeries({
                      name: previous.seriesName,
                      data: previous.data.map(({name, value}) => [name, value]),
                      lineStyle: {
                        color: theme.gray400,
                        type: 'dotted',
                      },
                      itemStyle: {
                        color: theme.gray400,
                      },
                    })
                  ),
                ],
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
    color: ${theme.gray500};
    font-family: ${theme.text.family};
    background: ${theme.gray800};
    padding: ${space(1)} ${space(2)};
    border-radius: ${theme.borderRadius} ${theme.borderRadius} 0 0;
  }
  .tooltip-series-solo {
    border-radius: ${theme.borderRadius};
  }
  .tooltip-label {
    margin-right: ${space(1)};
  }
  .tooltip-label strong {
    font-weight: normal;
    color: #fff;
  }
  .tooltip-series > div {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
  }
  .tooltip-date {
    border-top: 1px solid ${theme.gray600};
    text-align: center;
    position: relative;
    width: auto;
    border-radius: ${theme.borderRadiusBottom};
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
    border-top-color: ${theme.gray800};
    border-width: 8px;
    margin-left: -8px;
  }

  .echarts-for-react div:first-of-type {
    width: 100% !important;
  }
`;

const BaseChartRef = React.forwardRef((props, ref) => (
  <BaseChart forwardedRef={ref} {...props} />
));
BaseChartRef.displayName = 'forwardRef(BaseChart)';

export default BaseChartRef;
