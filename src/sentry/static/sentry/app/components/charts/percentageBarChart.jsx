import PropTypes from 'prop-types';
import React from 'react';
import moment from 'moment';

import BarSeries from './series/barSeries.jsx';
import BaseChart from './baseChart';
import Tooltip from './components/tooltip';
import XAxis from './components/xAxis';
import YAxis from './components/yAxis';

/**
 * A stacked 100% column chart over time
 *
 * See https://exceljet.net/chart-type/100-stacked-bar-chart
 */
export default class PercentageBarChart extends React.Component {
  static propTypes = {
    ...BaseChart.propTypes,

    series: PropTypes.arrayOf(
      PropTypes.shape({
        seriesName: PropTypes.string,
        data: PropTypes.arrayOf(
          PropTypes.shape({
            category: PropTypes.string,
            value: PropTypes.number,
          })
        ),
      })
    ),

    getCategoryName: PropTypes.func,
    getValue: PropTypes.func,
  };

  static get defaultProps() {
    return {
      getCategoryName: ({category, value}) => category,
      getValue: ({category, value}, total) =>
        !total ? 0 : Math.round(value / total * 1000) / 10,
    };
  }

  getSeries() {
    let {series, getCategoryName, getValue} = this.props;

    const totalsArray = series[0].data.map(({category, value}, i) => {
      return [category, series.reduce((sum, {data}) => sum + data[i].value, 0)];
    });
    const totals = new Map(totalsArray);
    return [
      ...series.map(({seriesName, data}) =>
        BarSeries({
          name: seriesName,
          stack: 'percentageBarChartStack',
          data: data.map(dataObj => [
            getCategoryName(dataObj),
            getValue(dataObj, totals.get(dataObj.category)),
          ]),
        })
      ),
      // Bar outline/filler if entire column is 0
      BarSeries({
        stack: 'percentageBarChartStack',
        silent: true,
        itemStyle: {
          normal: {
            color: '#eee',
          },
          hover: {
            color: '#eee',
          },
        },
        data: totalsArray.map(([category, total]) => [category, total === 0 ? 100 : 0]),
      }),
    ];
  }

  render() {
    return (
      <BaseChart
        {...this.props}
        options={{
          tooltip: Tooltip({
            // Make sure tooltip is inside of chart (because of overflow: hidden)
            confine: true,
          }),
          xAxis: XAxis({
            type: 'time',
            boundaryGap: true,
            axisTick: {
              alignWithLabel: true,
            },
            axisLabel: {
              formatter: (value, index) => moment(value).format('MMM D'),
            },
          }),
          yAxis: YAxis({
            min: 0,
            max: 100,
            type: 'value',
            interval: 25,
            splitNumber: 4,
            data: [0, 25, 50, 100],
            axisLabel: {
              formatter: '{value}%',
            },
          }),
          series: this.getSeries(),
        }}
      />
    );
  }
}
