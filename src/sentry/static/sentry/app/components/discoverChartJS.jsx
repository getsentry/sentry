import React from 'react';
import moment from 'moment/moment';
import {Line} from 'react-chartjs-2';

import PropTypes from 'prop-types';
import theme from 'app/utils/theme';
const { data } = require('./tempData.js');


export default class discoverChartJS extends React.Component {
  constructor(props) {
    super(props);
  }

  static defaultProps = {
    fill: false,
  };

  render() {
    const {title, fill} = this.props;
    const labels = data.map(entry => moment(entry.time).format('MM-DD'));
    const dataSet = data.map(entry => entry.aggregate);
    const dataSet2 = data.map(entry => entry.aggregate + entry.aggregate/12 * 13 + Math.random())

    // const prodData = data
    //   .filter(entry => entry.environment == 'prod')
    //   .map(entry => [entry.aggregate]);
    // const stagingData = data
    //   .filter(entry => entry.environment == 'staging')
    //   .map(entry => [entry.aggregate]);


    const dataAgg = {
      labels,
      datasets: [
        {
          label: 'Production Data',
          fill: fill,
          lineTension: 0.1,
          backgroundColor: 'rgba(75,192,192,0.4)',
          borderColor: 'rgba(75,192,192,1)',
          borderCapStyle: 'butt',
          borderDash: [],
          borderDashOffset: 0.0,
          borderJoinStyle: 'miter',
          pointBorderColor: 'rgba(75,192,192,1)',
          pointBackgroundColor: '#fff',
          pointBorderWidth: 1,
          pointHoverRadius: 5,
          pointHoverBackgroundColor: 'rgba(75,192,192,1)',
          pointHoverBorderColor: 'rgba(220,220,220,1)',
          pointHoverBorderWidth: 2,
          pointRadius: 1,
          pointHitRadius: 10,
          data: dataSet
        },
        {
          label: 'Staging Data',
          fill: fill,
          lineTension: 0.1,
          backgroundColor: theme.yellow, //'rgba(75,192,192,0.4)',
          borderColor: theme.yellow,//'rgba(75,192,192,1)',
          borderCapStyle: 'butt',
          borderDash: [],
          borderDashOffset: 0.0,
          borderJoinStyle: 'miter',
          pointBorderColor: theme.yellow,//'rgba(75,192,192,1)',
          pointBackgroundColor: '#fff',
          pointBorderWidth: 1,
          pointHoverRadius: 5,
          pointHoverBackgroundColor: theme.yellow, //'rgba(75,192,192,1)',
          pointHoverBorderColor: theme.yellow,//'rgba(220,220,220,1)',
          pointHoverBorderWidth: 2,
          pointRadius: 1,
          pointHitRadius: 10,
          data: dataSet2
        },
      ]
    };

    const optionStuff = {
			elements: {
				line: {
					tension: 0.000001
				}
			},
      responsive:true,
    };

    return (
      <div>
        <h2>{title}</h2>
        <Line data={dataAgg} options={optionStuff}/>
      </div>
    );
  }
}

// discoverChartJS.defaultProps = {
//   fill: false
// };