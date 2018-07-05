import React from 'react';
import moment from 'moment/moment';
import {Line} from 'react-chartjs-2';


const { data } = require('./tempData.js');

export default class discoverChartJS extends React.Component {
  constructor(props) {
    super(props);
  }

  render() {
    const labels = data.map(entry => moment(entry.time).format('MM-DD'));
    const dataSet = data.map(entry => entry.aggregate);
    const dataAgg = {
      labels,
      datasets: [
        {
          label: 'Recent Sentry Events',
          fill: 'origin',
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
        }
      ]
    };

    const optionStuff = {
			elements: {
				line: {
					tension: 0.000001
				}
			},
    };

    return (
      <div>
        <h2>Line Example</h2>
        <Line data={dataAgg} options={optionStuff}/>
      </div>
    )
  }
}
