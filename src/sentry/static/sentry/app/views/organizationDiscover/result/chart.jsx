import React from 'react';
import PropTypes from 'prop-types';
import LineChart from '../lineChart';

export default class Result extends React.Component {
  static propTypes = {
    data: PropTypes.object.isRequired,
  };

  getDataForChart(queryData, groupbyFields) {
    const output = {};
    queryData.forEach(data => {
      const key = groupbyFields.map(field => data[field]).join(',');
      if (key in output) {
        output[key].count.push(data.count);
      } else {
        output[key] = {count: [data.count]};
      }
    });

    return output;
  }

  render() {
    const {data} = this.props.data;
    const {fields} = this.props;


    console.log("data is: ", data);
    console.log("parsed data is: ", this.getDataForChart(data, fields));
    console.log("Fields:", fields);

    const chartData = this.getDataForChart(data, fields);

    return (
      <div>
        {`data for charts: ${JSON.stringify(this.props.data)}`}
        <LineChart data={this.props.data} chartData={chartData} style={{height: 200}} />
      </div>
    );
  }
}
