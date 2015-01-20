/*** @jsx React.DOM */
var React = require('react');
var $ = require('jquery');
var moment = require('moment');

// we need flot and the various plugins
require('flot');
require('flot/jquery.flot.resize');
require('flot/jquery.flot.time');

var average = function(a) {
  var r = {mean: 0, variance: 0, deviation: 0}, t = a.length;
  for (var m, s = 0, l = t; l--; s += a[l]);
  for (m = r.mean = s / t, l = t, s = 0; l--; s += Math.pow(a[l] - m, 2));
  r.deviation = Math.sqrt(r.variance = s / t);
  return r;
};

var percentile = function(a, nth) {
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

var tickFormatter = function (value, axis) {
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
    points: React.PropTypes.arrayOf(React.PropTypes.shape({
      x: React.PropTypes.number.isRequired,
      y: React.PropTypes.number.isRequired
    })),
  },

  renderChart: function(options) {
    var $el = $(this.refs.chartNode.getDOMNode());

    var points = [];
    var p95Inputs = [];
    this.props.points.forEach(function(point){
      p95Inputs.push(point.y);
      points.push([point.x * 1000, point.y]);
    });

    var p95th = percentile(p95Inputs);
    var dataAvg = [];
    points.forEach(function(point){
      dataAvg.push([point[0], p95th.mean]);
    });

    var plotData = [
      {
        data: points,
        color: 'rgba(86, 175, 232, 1)',
        shadowSize: 0,
        lines: {
          lineWidth: 2,
          show: true,
          fill: false
        }
      }
      // {
      //   data: dataAvg,
      //   color: 'rgba(244, 63, 32, .4)',
      //   // color: '#000000',
      //   shadowSize: 0,
      //   dashes: {
      //     lineWidth: 2,
      //     show: true,
      //     fill: false
      //   }
      // }
    ];
    var plotOptions = {
      xaxis: {
        mode: "time",
        tickFormatter: tickFormatter
      },
      yaxis: {
        min: 0,
        tickFormatter: function(value) {
          if (value > 999999) {
            return (value / 1000000) + 'mm';
          }
          if (value > 999) {
            return (value / 1000) + 'k';
          }
          return value;
        }
      },
      // tooltip: true,
      // tooltipOpts: {
      //   content: function(label, xval, yval, flotItem) {
      //     return yval + ' events<br>' + moment(xval).format('llll');
      //   },
      //   defaultTheme: false
      // },
      grid: {
        show: true,
        // hoverable: true,
        backgroundColor: '#ffffff',
        borderColor: '#DEE3E9',
        borderWidth: 2,
        tickColor: '#DEE3E9'
      },
      hoverable: false,
      legend: {
        noColumns: 5
      },
      lines: { show: false }
    };

    $(function(){
      $.plot($el, plotData, plotOptions);
    });

    // $(window).resize(function(){
    //   this.renderChart();
    // }.bind(this));
  },
  shouldComponentUpdate: function(nextProps, nextState) {
    return nextProps.points.length > 0;
  },
  componentDidUpdate: function() {
    this.renderChart();
  },
  componentDidMount: function() {
    this.renderChart();
  },
  render: function() {
    return (
      <figure className={this.props.className} ref="chartNode" />
    );
  }
});

module.exports = FlotChart;
