import PropTypes from 'prop-types';
import React from 'react';

import BarSeries from './series/barSeries.jsx';
import BaseChart from './baseChart';
import YAxis from './components/yAxis';
import XAxis from './components/xAxis';

export default class BarChart extends React.Component {
  static propTypes = {
    // We passthrough all props exception `options`
    ...BaseChart.propTypes,

    series: PropTypes.arrayOf(
      PropTypes.arrayOf(
        PropTypes.shape({
          name: PropTypes.string,
          category: PropTypes.string,
          value: PropTypes.number,
        })
      )
    ),
  };

  render() {
    const {series, stacked} = this.props;

    return (
      <BaseChart
        {...this.props}
        options={{
          xAxis: XAxis({
            type: 'category',
          }),
          yAxis: YAxis({}),
          series: series.map((s, i) => {
            return BarSeries({
              name: s.seriesName,
              stack: stacked ? 'stack1' : null,
              data: s.data.map(({value, category}) => [category, value]),
            });
          }),
        }}
      />
    );
  }
}
