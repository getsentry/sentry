import React from 'react';

import Highcharts from 'highcharts/highstock';
import {
  HighchartsStockChart,
  Chart,
  withHighcharts,
  XAxis,
  YAxis,
  Title,
  Subtitle,
  Legend,
  AreaSplineSeries,
  SplineSeries,
  Navigator,
  RangeSelector,
  Tooltip,
} from 'react-jsx-highstock';
import DateRangePickers from 'react-jsx-highstock-datepickers';
import 'react-jsx-highstock-datepickers/dist/index.css'; //default styles

import moment from 'moment';

const RED = '#FF0000';
const WHITE = '#FFFFFF';

const {data} = require('./tempData.js');

class HighChartsDiscover extends React.Component {
  constructor(props) {
    super(props);

    this.state = {
      bgColor: WHITE,
      seriesColor: RED,
      shadow: false,
    };
  }

  render() {
    const {bgColor, seriesColor, shadow} = this.state;
    let transformData = data.map(({time, aggregate}) => {
      return [moment(time).valueOf(), aggregate];
    });

    console.log(new Date('2018-04-17T15:00:00+00:00'));
    return (
      <div>
        <HighchartsStockChart>
          <Chart zoomType="x" />

          <Title>Highstocks Example</Title>
          <Subtitle>Using Date-Pickers</Subtitle>

          <Legend>
            <Legend.Title>Key</Legend.Title>
          </Legend>

          <DateRangePickers axisId="xAxis" />

          <RangeSelector>
            <RangeSelector.Button count={1} type="day">
              1d
            </RangeSelector.Button>
            <RangeSelector.Button count={7} type="day">
              7d
            </RangeSelector.Button>
            <RangeSelector.Button count={1} type="month">
              1m
            </RangeSelector.Button>
            <RangeSelector.Button type="all">All</RangeSelector.Button>
            <RangeSelector.Input boxBorderColor="#7cb5ec" />
          </RangeSelector>

          <Tooltip />

          <XAxis>
            <XAxis.Title>Time</XAxis.Title>
          </XAxis>

          <YAxis>
            <YAxis.Title>Events</YAxis.Title>
            <AreaSplineSeries id="Events" name="Events" data={transformData} />
          </YAxis>

          <Navigator>
            <Navigator.Series seriesId="events" />
          </Navigator>
        </HighchartsStockChart>
      </div>
    );
  }
}

export default withHighcharts(HighChartsDiscover, Highcharts);
