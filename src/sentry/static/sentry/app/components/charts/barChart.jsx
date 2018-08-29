import React from 'react';

import BarSeries from './series/barSeries.jsx';
import BaseChart from './baseChart';
import YAxis from './components/yAxis';
import XAxis from './components/xAxis';

export default class BarChart extends React.Component {
  static propTypes = {
    ...BaseChart.propTypes,
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
              data: s.data.map(({value, name}) => [name, value]),
            });
          }),
          ...this.props.options,
        }}
      />
    );
  }
}
