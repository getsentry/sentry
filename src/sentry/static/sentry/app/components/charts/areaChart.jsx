import React from 'react';
import PropTypes from 'prop-types';

import AreaSeries from './series/areaSeries';
import BaseChart from './baseChart';

class AreaChart extends React.Component {
  static propTypes = {
    ...BaseChart.propTypes,
    stacked: PropTypes.bool,
  };

  render() {
    const {series, stacked, colors, ...props} = this.props;

    return (
      <BaseChart
        {...props}
        series={series.map(({seriesName, data, ...otherSeriesProps}, i) =>
          AreaSeries({
            stack: stacked ? 'area' : false,
            name: seriesName,
            data: data.map(({name, value}) => [name, value]),
            color: colors && colors[i],
            lineStyle: {
              opacity: 1,
              width: 0.4,
            },
            areaStyle: {
              color: colors && colors[i],
              opacity: 1.0,
            },
            animation: false,
            animationThreshold: 1,
            animationDuration: 0,
            ...otherSeriesProps,
          })
        )}
      />
    );
  }
}

export default AreaChart;
