import React from 'react';
import moment from 'moment';
import PropTypes from 'prop-types';

import BarChart from 'app/components/charts/barChart';
import LineChart from 'app/components/charts/lineChart';
import theme from 'app/utils/theme';

export default class Result extends React.Component {
  static propTypes = {
    data: PropTypes.object.isRequired,
    query: PropTypes.object.isRequired,
  };

  // Converts a value to a string for the chart label. This could
  // potentially cause incorrect grouping, e.g. if the value null and string
  // 'null' are both present in the same series they will be merged into 1 value
  getLabel(value) {
    if (typeof value === 'object') {
      try {
        value = JSON.stringify(value);
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error(err);
      }
    }

    return value;
  }

  getChartData(queryData, groupbyFields) {
    const {aggregations} = this.props.query;
    // We only chart the first aggregation for now
    const aggregate = aggregations[0][2];
    const dates = [
      ...new Set(queryData.map(entry => moment.utc(entry.time * 1000).format('MMM Do'))),
    ];
    const output = {};
    queryData.forEach(data => {
      const key = groupbyFields.length
        ? groupbyFields.map(field => this.getLabel(data[field])).join(',')
        : aggregate;
      if (key in output) {
        output[key].data.push({
          value: data[aggregate],
          name: moment.utc(data.time * 1000).format('MMM Do'),
        });
      } else {
        output[key] = {
          data: [
            {value: data[aggregate], name: moment.utc(data.time * 1000).format('MMM Do')},
          ],
        };
      }
    });
    const result = [];
    for (let key in output) {
      const addDates = dates.filter(
        date => !output[key].data.map(entry => entry.name).includes(date)
      );
      for (let i = 0; i < addDates.length; i++) {
        output[key].data.push({
          value: null,
          name: addDates[i],
        });
      }

      result.push({seriesName: key, data: output[key].data});
    }
    return result;
  }

  checkLineChart(chartData) {
    for (let i = 0; i < chartData.length; i++) {
      if (chartData[i].data.filter(({value}) => value !== null).length > 1) {
        return true;
      }
    }
    return false;
  }

  render() {
    const {fields} = this.props.query;
    const {data} = this.props.data;

    const chartData = this.getChartData(data, fields);
    console.log('data', data);
    console.log('chart data', chartData);

    return (
      <div>
        {this.checkLineChart(chartData) ? (
          <LineChart
            series={chartData}
            style={{height: 300}}
            colors={theme.discoverCharts.colors}
          />
        ) : null}

        <BarChart
          series={chartData}
          stacked={true}
          style={{height: 300}}
          colors={theme.discoverCharts.colors}
        />
      </div>
    );
  }
}
