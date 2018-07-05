import React from 'react';

import Highcharts from 'highcharts';
import {
  HighchartsChart,
  withHighcharts,
  Chart,
  XAxis,
  YAxis,
  Title,
  Legend,
  LineSeries,
  RangeSelector,
  SplineSeries,
  AreaSeries,
  AreaRangeSeries,
  Tooltip,
} from 'react-jsx-highcharts';

const RED = '#FF0000';
const WHITE = '#FFFFFF';

class HighChartsDiscover extends React.Component {
  constructor(props) {
    super(props);

    this.state = {
      data: [1, 2, 3, 4, 1, 2, 3, 4, 1, 2, 3, 4, 1, 2, 3, 4, 1, 2, 3, 4],
      bgColor: WHITE,
      seriesColor: RED,
      shadow: false,
    };
  }

  handleToggleBackground = e => {
    e.preventDefault();
    this.setState({
      bgColor: this.state.bgColor === WHITE ? RED : WHITE,
      seriesColor: this.state.seriesColor === RED ? WHITE : RED,
    });
  };

  handleToggleShadow = e => {
    e.preventDefault();
    this.setState({
      shadow: !this.state.shadow,
    });
  };

  render() {
    const {data, bgColor, seriesColor, shadow} = this.state;

    return (
      <div>
        <HighchartsChart>
          <Chart zoomType="x" />
          <Title>Events Over Time</Title>

          <Chart backgroundColor={bgColor} shadow={shadow} />

          <Legend align="left">
            <Legend.Title>Legend</Legend.Title>
          </Legend>

          <XAxis type="datetime">
            <XAxis.Title>Time</XAxis.Title>
          </XAxis>

          <YAxis>
            <YAxis.Title># Of Events</YAxis.Title>
            <LineSeries name="Events" data={data} color={seriesColor} />
          </YAxis>
        </HighchartsChart>

        <div className="btn-toolbar" role="toolbar">
          <button className="btn btn-primary" onClick={this.handleToggleBackground}>
            Toggle background color
          </button>
          <button className="btn btn-primary" onClick={this.handleToggleShadow}>
            Toggle shadow
          </button>
        </div>
      </div>
    );
  }
}

export default withHighcharts(HighChartsDiscover, Highcharts);
