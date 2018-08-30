import 'zrender/lib/svg/svg';

import PropTypes from 'prop-types';
import React from 'react';
import ReactEchartsCore from 'echarts-for-react/lib/core';
import echarts from 'echarts/lib/echarts';

import theme from 'app/utils/theme';

import Grid from './components/grid';
import Tooltip from './components/tooltip';

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
    // e.g:
    // series: SentryTypes.Series,

    // see: https://ecomfe.github.io/echarts-doc/public/en/option.html
    options: PropTypes.object,

    // Chart height
    height: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),

    // Chart width
    width: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),

    // Use `canvas` when dealing with large datasets
    // See: https://ecomfe.github.io/echarts-doc/public/en/tutorial.html#Render%20by%20Canvas%20or%20SVG
    renderer: PropTypes.oneOf(['canvas', 'svg']),

    devicePixelRatio: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),

    // callback when chart is ready
    onChartReady: PropTypes.func,

    // theme name
    // example theme: https://github.com/apache/incubator-echarts/blob/master/theme/dark.js
    theme: PropTypes.string,

    // Default array of color codes to use in charts
    colors: PropTypes.arrayOf(PropTypes.string),

    // states whether or not to merge with previous `option`
    notMerge: PropTypes.bool,

    // states whether not to prevent triggering events when calling setOption
    silent: PropTypes.bool,

    // states whether not to update chart immediately
    lazyUpdate: PropTypes.bool,

    // Map of eventName -> function for echarts events
    onEvents: PropTypes.shape({
      highlight: PropTypes.func,
      mouseover: PropTypes.func,
    }),

    // Forwarded Ref
    forwardedRef: PropTypes.object,
  };

  static defaultProps = {
    height: 200,
    width: 'auto',
    renderer: 'svg',
    notMerge: true,
    lazyUpdate: false,
    options: {},
    onChartReady: () => {},
  };

  handleChartReady = (...args) => {
    let {onChartReady} = this.props;
    onChartReady(...args);
  };

  getColorPalette = () => {
    let {series} = this.props.options;

    return series && series.length
      ? theme.charts.getColorPalette(series.length)
      : theme.charts.colors;
  };

  render() {
    let {
      colors,
      devicePixelRatio,
      height,
      width,
      renderer,
      options,
      notMerge,
      lazyUpdate,
      silent,
      style,
      onEvents,
      forwardedRef,
    } = this.props;

    return (
      <ReactEchartsCore
        ref={forwardedRef}
        echarts={echarts}
        option={{
          color: colors || this.getColorPalette(),
          grid: Grid(),
          tooltip: Tooltip(),
          ...options,
        }}
        notMerge={notMerge}
        lazyUpdate={lazyUpdate}
        silent={silent}
        theme={this.props.theme}
        onChartReady={this.handleChartReady}
        onEvents={onEvents}
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
      />
    );
  }
}

const BaseChartRef = React.forwardRef((props, ref) => (
  <BaseChart forwardedRef={ref} {...props} />
));
BaseChartRef.displayName = 'forwardRef(BaseChart)';

export default BaseChartRef;
