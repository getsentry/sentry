import React from 'react';
import moment from 'moment';
import PropTypes from 'prop-types';
import _ from 'lodash';

import BarChart from 'app/components/charts/barChart';
import LineChart from 'app/components/charts/lineChart';

export default class Result extends React.Component {
  static propTypes = {
    data: PropTypes.object.isRequired,
    query: PropTypes.object.isRequired,
    maxCharsTooltip: PropTypes.number.isRequired,
    maxDataCharted: PropTypes.number,
  };

  static defaultProps = {
    maxDataCharted: 45,
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
    let sortedQueryData = _.sortBy(queryData, element => element.time);

    const dates = [
      ...new Set(
        sortedQueryData.map(entry => moment.utc(entry.time * 1000).format('MMM Do'))
      ),
    ];

    const output = {};
    sortedQueryData.forEach(data => {
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
            {
              value: data[aggregate],
              name: moment.utc(data.time * 1000).format('MMM Do'),
            },
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

      result.push({seriesName: this.createSubstring(key), data: output[key].data});
    }

    return result;
  }

  createSubstring(seriesName) {
    const {maxCharsTooltip} = this.props;
    let result = seriesName;
    if (seriesName.length > maxCharsTooltip) {
      result = seriesName.substring(0, maxCharsTooltip) + '…';
    }
    return result;
  }

  truncateChartData(chartData) {
    const {maxDataCharted} = this.props;
    return _.sortBy(chartData, element => element.data.length).slice(
      0,
      maxDataCharted + 1
    );
  }

  render() {
    const {fields} = this.props.query;
    const {data} = this.props.data;
    const {maxDataCharted} = this.props;

    let chartData = this.getChartData(data, fields);
    const renderLineChart = chartData.find(
      element => element.data.filter(({value}) => value !== null).length > 1
    );

    console.log('query data', data);
    console.log('Chart Data', chartData);

    if (chartData.length > maxDataCharted) {
      chartData = this.truncateChartData();
    }

    return (
      <div>
        {renderLineChart ? <LineChart series={chartData} height={300} /> : null}

        <BarChart series={chartData} stacked={true} height={300} />
      </div>
    );
  }
}
