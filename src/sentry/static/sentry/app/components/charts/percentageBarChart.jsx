import PropTypes from 'prop-types';
import React from 'react';
import moment from 'moment';

import BarSeries from './series/barSeries.jsx';
import BaseChart from './baseChart';
import Tooltip from './components/tooltip';
import XAxis from './components/xAxis';
import YAxis from './components/yAxis';

const FILLER_NAME = '__filler';

/**
 * A stacked 100% column chart over time
 *
 * See https://exceljet.net/chart-type/100-stacked-bar-chart
 */
export default class PercentageBarChart extends React.Component {
  static propTypes = {
    ...BaseChart.propTypes,

    getDataItemName: PropTypes.func,
    getValue: PropTypes.func,
  };

  static get defaultProps() {
    // TODO(billyvg): Move these into BaseChart? or get rid completely
    return {
      getDataItemName: ({name}) => name,
      getValue: ({name, value}, total) =>
        !total ? 0 : Math.round(value / total * 1000) / 10,
    };
  }

  getSeries() {
    let {series, getDataItemName, getValue} = this.props;

    const totalsArray = series[0].data.map(({name, value}, i) => {
      return [name, series.reduce((sum, {data}) => sum + data[i].value, 0)];
    });
    const totals = new Map(totalsArray);
    return [
      ...series.map(({seriesName, data}) =>
        BarSeries({
          barCategoryGap: 0,
          name: seriesName,
          stack: 'percentageBarChartStack',
          data: data.map(dataObj => [
            getDataItemName(dataObj),
            getValue(dataObj, totals.get(dataObj.name)),
          ]),
        })
      ),
      // Bar outline/filler if entire column is 0
      BarSeries({
        name: FILLER_NAME,
        stack: 'percentageBarChartStack',
        silent: true,
        itemStyle: {
          normal: {
            color: '#eee',
          },
        },
        emphasis: {
          itemStyle: {
            color: '#eee',
          },
        },
        data: totalsArray.map(([name, total]) => [name, total === 0 ? 100 : 0]),
      }),
    ];
  }

  render() {
    const series = this.getSeries();
    return (
      <BaseChart
        {...this.props}
        options={{
          tooltip: Tooltip({
            // Make sure tooltip is inside of chart (because of overflow: hidden)
            confine: true,
            formatter: seriesParams => {
              // Filter series that have 0 counts
              const date =
                `${seriesParams.length &&
                  moment(seriesParams[0].axisValue).format('MMM D, YYYY')}<br />` || '';
              return `${date} ${seriesParams
                .filter(
                  ({seriesName, data}) => data[1] > 0.001 && seriesName !== FILLER_NAME
                )
                .map(
                  ({marker, seriesName, data}) =>
                    `${marker} ${seriesName}:  <strong>${data[1]}</strong>%`
                )
                .join('<br />')}`;
            },
          }),
          xAxis: XAxis({
            type: 'time',
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
          series,
        }}
      />
    );
  }
}
