import PropTypes from 'prop-types';
import React from 'react';
import ReactEchartsCore from 'echarts-for-react/lib/core';
import 'zrender/lib/svg/svg';
import echarts from 'echarts/lib/echarts';

import theme from 'app/utils/theme';

class BaseChart extends React.Component {
  static propTypes = {
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
  };

  static defaultProps = {
    height: null,
    width: null,
    renderer: 'svg',
    notMerge: false,
    lazyUpdate: false,
    colors: theme.charts.colors,
    options: {},
    onChartReady: () => {},
  };

  handleChartReady = (...args) => {
    let {onChartReady} = this.props;
    onChartReady(...args);
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
    } = this.props;

    return (
      <ReactEchartsCore
        ref={e => (this.chart = e)}
        echarts={echarts}
        option={{
          color: colors,
          ...options,
        }}
        notMerge={notMerge}
        lazyUpdate={lazyUpdate}
        silent={silent}
        theme={this.props.theme}
        onChartReady={this.handleChartReady}
        onEvents={{
          /* TBD */
        }}
        opts={{
          height,
          width,
          renderer,
          devicePixelRatio,
        }}
        style={style}
      />
    );
  }
}
export default BaseChart;
