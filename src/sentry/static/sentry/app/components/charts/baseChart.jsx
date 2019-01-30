import 'zrender/lib/svg/svg';

import PropTypes from 'prop-types';
import React from 'react';
import ReactEchartsCore from 'echarts-for-react/lib/core';
import echarts from 'echarts/lib/echarts';

import {callIfFunction} from 'app/utils/callIfFunction';
import SentryTypes from 'app/sentryTypes';
import theme from 'app/utils/theme';

import Grid from './components/grid';
import Legend from './components/legend';
import LineSeries from './series/lineSeries';
import Tooltip from './components/tooltip';
import XAxis from './components/xAxis';
import YAxis from './components/yAxis';

// If dimension is a number conver it to pixels, otherwise use dimension without transform
const getDimensionValue = dimension => {
  if (typeof dimension === 'number') {
    return `${dimension}px`;
  }

  return dimension;
};

class BaseChart extends React.Component {
  static propTypes = {
    // TODO: Pull out props from generic `options` object
    // so that we can better document them in prop types
    // see: https://ecomfe.github.io/echarts-doc/public/en/option.html
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
    // Can pass an array of 2 objects to customize yAxis properties
    yAxes: PropTypes.oneOfType([
      PropTypes.bool,
      PropTypes.arrayOf(SentryTypes.EChartsYAxis),
    ]),

    // Tooltip options
    tooltip: SentryTypes.EChartsTooltip,

    // DataZoom (allows for zooming of chart)
    dataZoom: SentryTypes.EChartsDataZoom,

    toolBox: SentryTypes.EChartsToolBox,

    // ECharts Grid options
    grid: SentryTypes.EChartsGrid,

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
    forwardedRef: PropTypes.object,

    // Custom chart props that are implemented by us (and not a feature of eCharts)
    /**
     * Display previous period as a LineSeries
     */
    previousPeriod: PropTypes.arrayOf(SentryTypes.SeriesUnit),

    // If data is grouped by date, then apply default date formatting to
    // x-axis and tooltips.
    isGroupedByDate: PropTypes.bool,

    // Should we render hours on xaxis instead of day?
    shouldXAxisRenderTimeOnly: PropTypes.bool,

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
    shouldXAxisRenderTimeOnly: false,
  };

  getEventsMap = () => {
    return {
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

      isGroupedByDate,
      shouldXAxisRenderTimeOnly,
      previousPeriod,
      utc,
      yAxes,

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
      ? yAxis !== null ? YAxis(yAxis) : null
      : Array.isArray(yAxes) ? yAxes.slice(0, 2).map(YAxis) : [YAxis(), YAxis()];

    return (
      <ReactEchartsCore
        ref={forwardedRef}
        echarts={echarts}
        notMerge={notMerge}
        lazyUpdate={lazyUpdate}
        silent={silent}
        theme={this.props.theme}
        onChartReady={this.handleChartReady}
        onEvents={this.getEventsMap()}
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
          grid: Grid(grid),
          tooltip: tooltip !== null ? Tooltip({isGroupedByDate, utc, ...tooltip}) : null,
          legend: legend ? Legend({...legend}) : null,
          yAxis: yAxisOrCustom,
          xAxis:
            xAxis !== null
              ? XAxis({
                  ...xAxis,
                  shouldRenderTimeOnly: shouldXAxisRenderTimeOnly,
                  isGroupedByDate,
                  utc,
                })
              : null,
          series: !previousPeriod
            ? series
            : [
                ...series,
                ...previousPeriod.map(previous =>
                  LineSeries({
                    name: previous.seriesName,
                    data: previous.data.map(({name, value}) => [name, value]),
                    lineStyle: {
                      color: theme.gray1,
                      type: 'dotted',
                    },
                  })
                ),
              ],
          dataZoom,
          toolbox: toolBox,
        }}
      />
    );
  }
}

const BaseChartRef = React.forwardRef((props, ref) => (
  <BaseChart forwardedRef={ref} {...props} />
));
BaseChartRef.displayName = 'forwardRef(BaseChart)';

export default BaseChartRef;
