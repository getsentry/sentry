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

  generateBarData(series) {
    let xAxisLabels = new Set();

    const barData = series.map(s => {
      let tempSeries = {};
      s.data.forEach(({category, value}) => {
        xAxisLabels.add(category);
        tempSeries[category] = value;
      });
      return tempSeries;
    });
    return [barData, Array.from(xAxisLabels)];
  }

  render() {
    const {series, stacked} = this.props;
    const [barData, xAxisLabels] = this.generateBarData(series);

    return (
      <BaseChart
        {...this.props}
        options={{
          xAxis: XAxis({
            type: 'category',
            data: xAxisLabels,
          }),
          yAxis: YAxis({}),
          series: series.map((s, i) => {
            let data = xAxisLabels.map(label => {
              return barData[i].hasOwnProperty(label) ? barData[i][label] : 0;
            });
            return BarSeries({
              name: s.seriesName,
              stack: stacked ? 'stack1' : null,
              data,
            });
          }),
        }}
      />
    );
  }
}
