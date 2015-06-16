var React = require('react');
var jQuery = require('jquery');
var moment = require('moment');

// we need flot and the various plugins
require('flot');
require('flot/jquery.flot.stack');
require('flot/jquery.flot.time');
require('flot-tooltip/jquery.flot.tooltip');

var average = (a) => {
  var r = {mean: 0, variance: 0, deviation: 0}, t = a.length;
  for (var m, s = 0, l = t; l--; s += a[l]);
  for (m = r.mean = s / t, l = t, s = 0; l--; s += Math.pow(a[l] - m, 2));
  r.deviation = Math.sqrt(r.variance = s / t);
  return r;
};

var percentile = (a, nth) => {
  a = a.sort();
  a.slice(0, a.length - Math.floor(nth / a.length));
  return average(a);
};

var timeUnitSize = {
  "second": 1000,
  "minute": 60 * 1000,
  "hour": 60 * 60 * 1000,
  "day": 24 * 60 * 60 * 1000,
  "month": 30 * 24 * 60 * 60 * 1000,
  "quarter": 3 * 30 * 24 * 60 * 60 * 1000,
  "year": 365.2425 * 24 * 60 * 60 * 1000
};

var tickFormatter = (value, axis) => {
  var d = moment(value);

  var t = axis.tickSize[0] * timeUnitSize[axis.tickSize[1]];
  var span = axis.max - axis.min;
  var fmt;

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

var FlotChart = React.createClass({
  propTypes: {
    plotData: React.PropTypes.array
  },

  renderChart(options) {
    var plotOptions = {
      xaxis: {
        mode: "time",
        minTickSize: [1, "day"],
        tickFormatter: tickFormatter
      },
      yaxis: {
        min: 0,
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
        content: (label, xval, yval, flotItem) => {
          xval = parseInt(xval, 10);
          if(typeof yval.toLocaleString == "function") {
              return yval.toLocaleString() + ' events ' + flotItem.series.label.toLowerCase() + '<br>' + moment(xval).format('llll');
          }
          return yval + ' events<br>' + moment(xval).format('llll');
        },
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
        noColumns: 2,
        position: 'nw'
      },
      lines: { show: false }
    };

    var chart = this.refs.chartNode.getDOMNode();
    jQuery.plot(chart, this.props.plotData, plotOptions);
  },

  shouldComponentUpdate(nextProps, nextState) {
    // TODO(dcramer): improve logic here
    return nextProps.plotData.length > 0;
  },

  componentDidUpdate() {
    this.renderChart();
  },

  componentDidMount() {
    this.renderChart();
    jQuery(window).resize(this.renderChart);
  },

  componentWillUnount() {
    jQuery(window).unbind('resize', this.renderChart);
  },

  render() {
    return (
      <figure className={this.props.className} ref="chartNode" />
    );
  }
});

module.exports = FlotChart;
