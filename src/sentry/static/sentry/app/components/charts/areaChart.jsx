import React from 'react';
import PropTypes from 'prop-types';

import theme from 'app/utils/theme';

import AreaSeries from './series/areaSeries';
import BaseChart from './baseChart';

class AreaChart extends React.Component {
  static propTypes = {
    ...BaseChart.propTypes,
    stacked: PropTypes.bool,
  };

  render() {
    const {series, stacked, ...props} = this.props;
    const colors =
      (series && series.length && theme.charts.getColorPalette(series.length)) || {};

    return (
      <BaseChart
        {...props}
        series={series.map((s, i) =>
          AreaSeries({
            stack: stacked ? 'area' : false,
            name: s.seriesName,
            data: s.data.map(({name, value}) => [name, value]),
            lineStyle: {
              color: '#fff',
              width: 2,
            },
            areaStyle: {
              color: colors[i],
              opacity: 1.0,
            },
          })
        )}
      />
    );
  }
}

export default AreaChart;
