import React from 'react';
import ReactEcharts from 'echarts-for-react';
import moment from 'moment/moment';
import theme from 'app/utils/theme';

const {data} = require('./tempData.js');

export default class discoverEcharts extends React.Component {
  getOption = () => {
    const labels = data.map(entry => moment(entry.time).format('MM-DD'));
    const dataSet = data.map(entry => entry.aggregate);
    const dataSet2 = data.map(
      entry => entry.aggregate + entry.aggregate / 12 * 13 + Math.random()
    );

    return {
      title: {
        text: 'Echarts Demo',
      },
      tooltip: {
        trigger: 'axis', // or 'item' // https://ecomfe.github.io/echarts-doc/public/en/option.html#tooltip.trigger
      },
      legend: {
        data: labels,
      },
      toolbox: {
        feature: {
          saveAsImage: {},
        },
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
          color: theme.blueDark,
        },
        {
          name: 'Aggregate Events over Time 2',
          type: 'line',
          stack: 'Aggregates 2',
          areaStyle: {normal: {}},
          data: dataSet2,
          color: theme.gray2,
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
