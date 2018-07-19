import PropTypes from 'prop-types';
import React from 'react';

import theme from 'app/utils/theme';

import PieSeries from './series/pieSeries';
import BaseChart from './baseChart';
import Tooltip from './components/tooltip';

class PieChart extends React.Component {
  static propTypes = {
    /**
       * Height of chart
       */
    height: PropTypes.number,
    name: PropTypes.string,
    data: PropTypes.arrayOf(
      PropTypes.shape({
        name: PropTypes.string,
        value: PropTypes.number,
      })
    ),
  };

  render() {
    const {height, name, data} = this.props;
    if (!data.length) return null;

    return (
      <BaseChart
        height={height}
        colors={theme.charts.colors}
        options={{
          tooltip: Tooltip(),
          title: {},
          legend: {},
          grid: {
            top: 24,
            bottom: 40,
            left: '10%',
            right: '10%',
          },
          series: [
            PieSeries({
              name,
              data,
              avoidLabelOverlap: false,
              label: {
                normal: {
                  formatter: '{b}\n{d}%',
                  show: false,
                  position: 'center',
                },
                emphasis: {
                  show: true,
                  textStyle: {
                    fontSize: '18',
                  },
                },
              },
              itemStyle: {
                normal: {
                  label: {
                    show: false,
                  },
                  labelLine: {
                    show: false,
                  },
                },
              },
            }),
          ],
        }}
      />
    );
  }
}

export default PieChart;
