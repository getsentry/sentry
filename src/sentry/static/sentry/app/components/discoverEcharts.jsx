import React from 'react';
import ReactEcharts from 'echarts-for-react';
import moment from 'moment/moment';

const {data} = require('./tempData.js');

export default class discoverEcharts extends React.Component {
  getOption = () => {
    const labels = data.map(entry => moment(entry.time).format('MM-DD'));
    const dataSet = data.map(entry => entry.aggregate);

    return {
      title: {
        text: 'Echarts Demo',
      },
      tooltip: {
        trigger: 'axis', //https://ecomfe.github.io/echarts-doc/public/en/option.html#tooltip.trigger
      },
      legend: {
        data: labels,
      },
      toolbox: {
        feature: {
          saveAsImage: {},
        }
      },
      grid: {
        left: '3%',
        right: '4%',
        bottom: '3%',
        containLabel: true,
      },
      xAxis: [
        {
          type: 'category',
          boundaryGap: false,
          data: labels,
        },
      ],
      yAxis: [
        {
          type: 'value',
        },
      ],
      series: [
        {
          name: 'Aggregate Events over Time',
          type: 'line',
          stack: 'Aggregates',
          areaStyle: {normal: {}},
          data: dataSet,
        },
      ],
    };
  };

  render() {
    return (
      <div>
        <ReactEcharts
          option={this.getOption()}
          style={{height: '350px', width: '100%'}}
          className="react_for_echarts"
        />
      </div>
    );
  }
}
