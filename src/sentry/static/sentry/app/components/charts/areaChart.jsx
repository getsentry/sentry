import React from 'react';
import PropTypes from 'prop-types';

import AreaSeries from './series/areaSeries';
import BaseChart from './baseChart';
import {AREA_COLORS} from './utils';

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
            name: seriesName,
            data: data.map(({name, value}) => [name, value]),
            color: AREA_COLORS[i].line,
            areaStyle: {
              color: AREA_COLORS[i].area,
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
