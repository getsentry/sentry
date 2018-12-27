import PropTypes from 'prop-types';
import React from 'react';
import moment from 'moment';

import theme from 'app/utils/theme';

import AreaSeries from './series/areaSeries';
import BaseChart from './baseChart';
import LineSeries from './series/lineSeries';
import XAxis from './components/xAxis';
import YAxis from './components/yAxis';

class AreaChart extends React.Component {
  static propTypes = {
    // We passthrough all props exception `options`
    ...BaseChart.propTypes,

    startDate: PropTypes.string,
    series: PropTypes.arrayOf(
      PropTypes.shape({
        name: PropTypes.string,
        data: PropTypes.arrayOf(PropTypes.number),
      })
    ),
    /**
     * Other line series to display
     */
    lines: PropTypes.arrayOf(
      PropTypes.shape({
        name: PropTypes.string,
        data: PropTypes.arrayOf(PropTypes.number),
      })
    ),
  };

  render() {
    const {series, lines, startDate, ...props} = this.props;
    if (!series.length) return null;

    const numDates = series[0].data.length;
    const DATES = [...Array(numDates)].map((value, i) =>
      moment(startDate)
        .add(i, 'day')
        .format('MMM D')
    );

    return (
      <BaseChart
        {...props}
        options={{
          xAxis: XAxis({
            type: 'category',
            data: DATES,
            boundaryGap: false,
          }),
          yAxis: YAxis({}),
          series: [
            ...series.map((s, i) =>
              AreaSeries({
                stack: 'test',
                name: s.name,
                data: s.data,
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
            ...lines.map(s =>
              LineSeries({
                name: s.name,
                data: s.data,
                lineStyle: {
                  color: theme.gray1,
                  type: 'dotted',
                },
              })
            ),
          ],
        }}
      />
    );
  }
}

export default AreaChart;
