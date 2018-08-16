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
    for (let item in chartData) {
      if (item.data && item.data.filter(({value}) => value !== null).length > 1) {
        return true;
      }
    }
    return false;
  }

  render() {
    const {fields} = this.props.query;
    const {data} = this.props.data;

    // const data = [{"event_id": "09cb3bb51ac4457cbcbbd6adc7076f0a", "count": 1, "time": 1533686400}, {"event_id": "2493b895da1e450e9f5877ce5a070b5e", "count": 1, "time": 1533600000}, {"event_id": "8f3302ac4f844389b2ef1cee0891d0b7", "count": 1, "time": 1533600000}, {"event_id": "f8311eb5478e4bb3b215d25d8e516087", "count": 1, "time": 1533772800}, {"event_id": "4a6a44db6d8e487781c2aae49cb4875e", "count": 1, "time": 1533772800}, {"event_id": "1a98b8c5909949e691dbbbd941854860", "count": 1, "time": 1533600000}, {"event_id": "15b3c1c690e54e38b1fdf462abc70073", "count": 1, "time": 1533254400}, {"event_id": "7c41882d3b0e4ddfac2078f37aad6d9c", "count": 1, "time": 1534032000}, {"event_id": "e1b970e7c88c4d7f8d98030132314ef8", "count": 1, "time": 1533427200}, {"event_id": "d707d6861c794ec8abf58a7901905933", "count": 1, "time": 1533686400}, {"event_id": "17be32c3480548ffb949fd829fc3119d", "count": 1, "time": 1533859200}, {"event_id": "6f31cc213e834cf79c9909ad25278794", "count": 1, "time": 1533686400}, {"event_id": "55abea4dc3794def84b6f32cd9bb432e", "count": 1, "time": 1533686400}, {"event_id": "355aa3eb761e452cae64a435ab35ae9b", "count": 1, "time": 1534032000}, {"event_id": "db74f49f75e2435a96121373df1c4e2e", "count": 1, "time": 1533772800}]
    const chartData = this.getChartData(data, fields);
    console.log('data', data);
    console.log('chart data', chartData);

    return (
      <div>
        {chartData && this.checkLineChart(chartData) ? (
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
