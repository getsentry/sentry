import PropTypes from 'prop-types';
import React from 'react';

import BaseChart from './baseChart';
import LineSeries from './series/lineSeries';

export default class LineChart extends React.Component {
  static propTypes = {
    ...BaseChart.propTypes,
    seriesOptions: PropTypes.object,
  };

  render() {
    const {series, seriesOptions, ...props} = this.props;

    return (
      <BaseChart
        {...props}
        series={series.map(({seriesName, data, dataArray, ...options}) =>
          LineSeries({
            ...seriesOptions,
            ...options,
            name: seriesName,
            data: dataArray || data.map(({value, name}) => [name, value]),
            animation: false,
            animationThreshold: 1,
            animationDuration: 0,
          })
        )}
      />
    );
  }
}
