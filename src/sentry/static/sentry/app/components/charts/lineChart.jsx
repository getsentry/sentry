import React from 'react';
import BaseChart from './baseChart';
import XAxis from './components/xAxis';
import YAxis from './components/yAxis';
import LineSeries from './series/lineSeries';

export default class LineChart extends React.Component {
  static propTypes = {
    ...BaseChart.propTypes,
  };

  render() {
    const {series, ...props} = this.props;

    return (
      <BaseChart
        {...props}
        options={{
          xAxis: XAxis({
            type: 'category',
            boundaryGap: false,
          }),
          yAxis: YAxis({}),
          series: series.map(s => {
            return LineSeries({
              name: s.seriesName,
              data: s.data.map(({value, name}) => [name, value]),
            });
          }),
        }}
      />
    );
  }
}
