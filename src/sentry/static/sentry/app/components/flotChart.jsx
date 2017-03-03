import React from 'react';
import ReactDOM from 'react-dom';
import jQuery from 'jquery';
import moment from 'moment';

// we need flot and the various plugins
require('flot');
require('flot/jquery.flot.stack');
require('flot/jquery.flot.time');
require('flot-tooltip/jquery.flot.tooltip');

let timeUnitSize = {
  'second': 1000,
  'minute': 60 * 1000,
  'hour': 60 * 60 * 1000,
  'day': 24 * 60 * 60 * 1000,
  'month': 30 * 24 * 60 * 60 * 1000,
  'quarter': 3 * 30 * 24 * 60 * 60 * 1000,
  'year': 365.2425 * 24 * 60 * 60 * 1000
};

let numberWithCommas = function(x) {
  return x.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
};

let buildTooltipHandler = function(series) {
  return function(_l, xval, _y, flotItem) {
    let yval;
    let content = '<h6>' + moment(parseInt(xval, 10)).format('MMMM D YYYY HH:mm z') + '</h6>';
    for (let i = 0; i < series.length; i++) {
      // we're assuming series are identical
      yval = numberWithCommas(series[i].data[flotItem.dataIndex][1] || 0);
      content += '<strong style="color:' + series[i].color + '">' + series[i].label + ':</strong> ' + yval + '<br>';
    }
    return content;
  };
};

let tickFormatter = (value, axis) => {
  let d = moment(parseInt(value, 10));

  let t = axis.tickSize[0] * timeUnitSize[axis.tickSize[1]];
  let span = axis.max - axis.min;
  let fmt;

  if (t < timeUnitSize.minute) {
    fmt = 'LT';
  } else if (t < timeUnitSize.day) {
    fmt = 'LT';
    if (span < 2 * timeUnitSize.day) {
      fmt = 'LT';
    } else {
      fmt = 'MMM D LT';
    }
  } else if (t < timeUnitSize.month) {
    fmt = 'MMM D';
  } else if (t < timeUnitSize.year) {
    if (span < timeUnitSize.year) {
      fmt = 'MMM';
    } else {
      fmt = 'MMM YY';
    }
  } else {
    fmt = 'YY';
  }

  return d.format(fmt);
};

const FlotChart = React.createClass({
  propTypes: {
    plotData: React.PropTypes.array,
    style: React.PropTypes.object
  },

  componentDidMount() {
    this.renderChart();
    jQuery(window).resize(this.renderChart);
  },

  shouldComponentUpdate(nextProps, nextState) {
    // TODO(dcramer): improve logic here
    return nextProps.plotData.length > 0;
  },

  componentDidUpdate() {
    this.renderChart();
  },

  componentWillUnmount() {
    jQuery(window).unbind('resize', this.renderChart);
  },

  renderChart(options) {
    let series = this.props.plotData;
    let plotOptions = {
      xaxis: {
        mode: 'time',
        minTickSize: [1, 'day'],
        tickFormatter: tickFormatter
      },
      yaxis: {
        min: 0,
        minTickSize: 1,
        tickFormatter: (value) => {
          if (value > 999999) {
            return (value / 1000000) + 'mm';
          }
          if (value > 999) {
            return (value / 1000) + 'k';
          }
          return value;
        }
      },
      tooltip: true,
      tooltipOpts: {
        content: buildTooltipHandler(series),
        defaultTheme: false
      },
      grid: {
        show: true,
        hoverable: true,
        backgroundColor: '#ffffff',
        borderColor: '#DEE3E9',
        borderWidth: 2,
        tickColor: '#DEE3E9'
      },
      hoverable: false,
      legend: {
        noColumns: series.length,
        position: 'nw'
      },
      lines: {show: false},
    };

    let chart = ReactDOM.findDOMNode(this.refs.chartNode);
    jQuery.plot(chart, series, plotOptions);
  },

  render() {
    return (
      <figure
        className={this.props.className || 'chart'}
        style={this.props.style}
        ref="chartNode" />
    );
  }
});

export default FlotChart;
