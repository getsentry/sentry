import React from 'react';

import BarSeries from './series/barSeries';
import BaseChart from './baseChart';

export default class BarChart extends React.Component {
  static propTypes = {
    ...BaseChart.propTypes,
  };

  render() {
    const {series, stacked, xAxis, ...props} = this.props;

    return (
      <BaseChart
        {...props}
        xAxis={xAxis !== null ? {...(xAxis || {}), boundaryGap: true} : null}
        series={series.map((s, i) => {
          return BarSeries({
            name: s.seriesName,
            stack: stacked ? 'stack1' : null,
            data: s.data.map(({value, name}) => [name, value]),
          });
        })}
      />
    );
  }
}
