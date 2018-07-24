import PropTypes from 'prop-types';
import React from 'react';
import moment from 'moment';

import theme from 'app/utils/theme';

import BaseChart from 'app/components/charts/baseChart';
import Tooltip from 'app/components/charts/components/tooltip';
import XAxis from 'app/components/charts/components/xAxis';
import YAxis from 'app/components/charts/components/yAxis';
import LineSeries from "../../components/charts/series/lineSeries";

import _ from 'lodash';

// const {data} = require('./result/transactionData');

export default class lineChart extends React.Component {
  static propTypes = {
    ...BaseChart.propTypes,
  };

  defineSeries = ([key, value], idx) => {
    return LineSeries({
      name: key,
      type: 'line',
      data: value.count,
      // data: value.map(entry => entry.count),
      color: theme.charts.colors[idx],
    });
  };

  render() {
    const {chartData, data, ...props} = this.props;

    // const series = Object.entries(this.getLineSeries(data.data, groupBy)).map(this.defineSeries);
    const series = Object.entries(chartData).map(this.defineSeries);

    const dates = data.data.map(entry => moment(entry.time * 1000).format('MM-DD'));

    console.log("dates", dates);
    console.log("received chartdata", chartData);
    console.log("series", series);
    console.log("data: ", data);

    if( !series.length ||
      series.length === 1 && (!series[0].data || series[0].data.length <= 1)) {
      return null; // if no data or only one data point.
    }

    return (
      <BaseChart
        {...props}
        options={{
          tooltip: Tooltip(),
          title: {},
          legend: {},
          grid: {
            top: 24,
            bottom: 40,
            left: '10%',
            right: '10%',
          },
          xAxis: XAxis({
            type: 'category',
            data: dates,
          }),
          yAxis: YAxis({}),
          series,
        }}
      />
    );
  }
}