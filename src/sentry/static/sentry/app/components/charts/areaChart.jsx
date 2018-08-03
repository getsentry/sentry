import moment from 'moment';
import React from 'react';

import theme from 'app/utils/theme';
import SentryTypes from 'app/sentryTypes';

import AreaSeries from './series/areaSeries';
import BaseChart from './baseChart';
import LineSeries from './series/lineSeries';
import XAxis from './components/xAxis';
import YAxis from './components/yAxis';

class AreaChart extends React.Component {
  static propTypes = {
    ...BaseChart.propTypes,

    /**
     * Display previous period as a line
     */
    previousPeriod: SentryTypes.SeriesUnit,
  };

  render() {
    const {series, previousPeriod, ...props} = this.props;
    if (!series.length) return null;

    return (
      <BaseChart
        {...props}
        options={{
          xAxis: XAxis({
            type: 'time',
            boundaryGap: false,
            axisLabel: {
              formatter: (value, index) => moment(value).format('MMM D'),
            },
          }),
          yAxis: YAxis({}),
          series: [
            ...series.map((s, i) =>
              AreaSeries({
                stack: 'test',
                name: s.seriesName,
                data: s.data.map(({name, value}) => [name, value]),
                lineStyle: {
                  color: '#fff',
                  width: 2,
                },
                areaStyle: {
                  color: theme.charts.colors[i],
                  opacity: 1.0,
                },
              })
            ),
            previousPeriod &&
              LineSeries({
                name: previousPeriod.seriesName,
                data: previousPeriod.data.map(({name, value}) => [name, value]),
                lineStyle: {
                  color: theme.gray1,
                  type: 'dotted',
                },
              }),
          ],
        }}
      />
    );
  }
}

export default AreaChart;
