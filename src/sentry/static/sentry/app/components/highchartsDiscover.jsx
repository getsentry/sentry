import React from 'react';

import Highcharts from 'highcharts';
import {
  HighchartsChart, withHighcharts, Chart, XAxis, YAxis, Title, Legend, LineSeries, RangeSelector,
  SplineSeries, AreaSeries, AreaRangeSeries, Tooltip
} from 'react-jsx-highcharts';
import moment from 'moment';

const RED = '#FF0000';
const WHITE = '#FFFFFF';

const { data } = require('./tempData.js');

class HighChartsDiscover extends React.Component {
  constructor (props) {
    super(props);

    this.state = {
        series: [{
            name: 'series 1',
            data: [
                [moment("2018-03-31T00:00:00+00:00").valueOf(), 746],
                [moment("2018-03-31T01:00:00+00:00").valueOf(), 562],
                [moment("2018-03-31T02:00:00+00:00").valueOf(), 1195],
                [moment("2018-03-31T03:00:00+00:00").valueOf(), 3140],
                 [moment("2018-03-31T04:00:00+00:00").valueOf(), 734],
                [moment("2018-03-31T05:00:00+00:00").valueOf(), 981],
                [moment("2018-03-31T06:00:00+00:00").valueOf(), 395],
                [moment("2018-03-31T07:00:00+00:00").valueOf(), 842],

            ]
        }],
        bgColor: WHITE,
        seriesColor: RED,
        shadow: false
    }




    // "data": [
    //     {
    //         "time": "2018-03-31T00:00:00+00:00",
    //         "aggregate": 746
    //     },
    //     {
    //         "time": "2018-03-31T01:00:00+00:00",
    //         "aggregate": 562
    //     },
    //     {
    //         "time": "2018-03-31T02:00:00+00:00",
    //         "aggregate": 1195
    //     },
    //     {
    //         "time": "2018-03-31T03:00:00+00:00",
    //         "aggregate": 3140
    //     },
    //     {
    //         "time": "2018-03-31T04:00:00+00:00",
    //         "aggregate": 734
    //     },
    //     {
    //         "time": "2018-03-31T05:00:00+00:00",
    //         "aggregate": 981
    //     },
    //     {
    //         "time": "2018-03-31T06:00:00+00:00",
    //         "aggregate": 395
    //     },
    //     {
    //         "time": "2018-03-31T07:00:00+00:00",
    //         "aggregate": 842
    //     },



    // this.state = {
    //   data: [
    //     {
    //         time: "2018-04-01T08:00:00+00:00",
    //         aggregate: [500]
    //     },
    //     {
    //         time: "2018-04-17T15:00:00+00:00",
    //         aggregate: 3551
    //     },
    //     {
    //         time: "2018-04-02T09:00:00+00:00",
    //         aggregate: 2296
    //     },
    //     {
    //         time: "2018-05-13T22:00:00+00:00",
    //         aggregate: 182
    //     },
    //     {
    //         time: "2018-05-01T11:00:00+00:00",
    //         aggregate: 3630
    //     },
    //     {
    //         time: "2018-04-30T01:00:00+00:00",
    //         aggregate: 4348
    //     }],
    //   bgColor: WHITE,
    //   seriesColor: RED,
    //   shadow: false
    // };
  }

  handleToggleBackground = e => {
    e.preventDefault();
    this.setState({
      bgColor: this.state.bgColor === WHITE ? RED : WHITE,
      seriesColor: this.state.seriesColor === RED ? WHITE : RED
    });
  }

  handleToggleShadow = e => {
    e.preventDefault();
    this.setState({
      shadow: !this.state.shadow
    });
  }



  render() {
    const {bgColor, seriesColor, shadow } = this.state;
    let transformData = data.map(({time, aggregate}) => {
        return [moment(time).valueOf(), aggregate]
    });


    const plotOptions =  {
      spline: {
        lineWidth: 4,
        states: {
        hover: {
          lineWidth: 5
        }
      },
      marker: {
        enabled: false
      },
      pointInterval: 86400000, // one day
      pointStart: moment()
          .subtract(3, 'months')
          .valueOf()}
    }


    console.log(new Date("2018-04-17T15:00:00+00:00"));
    return (
      <div>
        <HighchartsChart plotOptions={plotOptions}>
          <Chart zoomType="x" />
          <Title>Aggregates Over Time</Title>

          <Chart backgroundColor={bgColor} shadow={shadow} />

          <Legend align="left">
            <Legend.Title>Legend</Legend.Title>
          </Legend>
          <Tooltip/>

          <XAxis type="datetime" minTickInterval={moment.duration(1, 'day').asMilliseconds()}>
            <XAxis.Title>Time</XAxis.Title>
          </XAxis>

          <YAxis>
            <YAxis.Title># Of Events</YAxis.Title>
              {/*{this.state.series.map(s => (*/}
                  {/*<LineSeries name={s.name} data={s.data} color={RED} />*/}
              {/*))}*/}

            <LineSeries name="Events" data={transformData} color={seriesColor} />
            {/*<LineSeries name="Events2" data={[2,2,2]} color={RED} />*/}
            {/*<LineSeries name="Events2" data={[1,1,1]} color={RED} />*/}
          </YAxis>
        </HighchartsChart>

        <div className="btn-toolbar" role="toolbar">
          <button className="btn btn-primary" onClick={this.handleToggleBackground}>Toggle background color</button>
          <button className="btn btn-primary" onClick={this.handleToggleShadow}>Toggle shadow</button>
        </div>
      </div>
    );
  }
}

export default withHighcharts(HighChartsDiscover, Highcharts);