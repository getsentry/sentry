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
    const {series, stacked, ...props} = this.props;

    return (
      <BaseChart
        {...props}
        series={series.map(({seriesName, data, ...otherSeriesProps}) =>
          AreaSeries({
            stack: stacked ? 'area' : false,
            ...otherSeriesProps,
            name: seriesName,
            data: data.map(({name, value}) => [name, value]),
            color: '#948BCF',
            areaStyle: {
              color: '#C4BFE9',
              opacity: 1.0,
            },
          })
        )}
      />
    );
  }
}

export default AreaChart;
