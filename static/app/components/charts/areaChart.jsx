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
        series={series.map(({seriesName, data, ...otherSeriesProps}, i) =>
          AreaSeries({
            stack: stacked ? 'area' : false,
            areaStyle: {opacity: 1.0},
            ...otherSeriesProps,
            name: seriesName,
            data: data.map(({name, value}) => [name, value]),
          })
        )}
      />
    );
  }
}

export default AreaChart;
