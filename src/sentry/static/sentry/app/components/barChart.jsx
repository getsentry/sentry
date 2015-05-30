/*** @jsx React.DOM */

var jQuery = require("jquery");
var moment = require("moment");
var React = require("react");

var TooltipTrigger = require("./TooltipTrigger");
var {compareArrays} = require("../utils");

var BarChart = React.createClass({
  propTypes: {
    points: React.PropTypes.arrayOf(React.PropTypes.shape({
      x: React.PropTypes.number.isRequired,
      y: React.PropTypes.number.isRequired,
      label: React.PropTypes.string
    })),
    interval: React.PropTypes.string,
    placement: React.PropTypes.string,
    label: React.PropTypes.string
  },

  getDefaultProps() {
    return {
      placement: "bottom",
      points: [],
      label: "events"
    };
  },

  componentDidUpdate() {
    this.renderChart();
  },

  componentDidMount() {
    this.renderChart();
  },

  floatFormat(number, places) {
      var multi = Math.pow(10, places);
      return parseInt(number * multi, 10) / multi;
  },

  timeLabelAsHour(point) {
    var timeMoment = moment(point.x * 1000);
    var nextMoment = timeMoment.clone().add(59, "minute");

    return (
      '<span>' +
        timeMoment.format("LL") + '<br />' +
        timeMoment.format("LT") + ' &mdash;&rsaquo; ' + nextMoment.format("LT") +
      '</span>'
    );
  },

  timeLabelAsDay(point) {
    var timeMoment = moment(point.x * 1000);
    var nextMoment = timeMoment.clone().add(59, "minute");

    return (
      '<span>' +
        timeMoment.format("LL") +
      '</span>'
    );
  },

  timeLabelAsRange(interval, point) {
    var timeMoment = moment(point.x * 1000);
    var nextMoment = timeMoment.clone().add(interval - 1, "second");

    return (
      '<span>' +
        timeMoment.format("lll") + '<br />' +
        '&mdash;&rsaquo; ' + nextMoment.format("lll") +
      '</span>'
    );
  },

  timeLabelAsFull(point) {
    var timeMoment = moment(point.x * 1000);
    return timeMoment.format("lll");
  },

  shouldComponentUpdate(nextProps, nextState) {
    var curPoints = this.props.points || [];
    var nextPoints = nextProps.points || [];
    var equal = compareArrays(this.props.points, nextProps.points, (obj, other) => {
      return (obj.x === other.x && obj.y === other.y);
    });
    return !equal;
  },

  renderChart() {
    var points = this.props.points;
    var maxval = 10;
    points.forEach((point) => {
      if (point.y > maxval) {
        maxval = point.y;
      }
    });

    var pointWidth = this.floatFormat(100.0 / points.length, 2) + "%";

    var interval = (points.length > 1 ? points[1].x - points[0].x : null);
    var timeLabelFunc;
    switch (interval) {
      case 3600:
        timeLabelFunc = this.timeLabelAsHour;
        break;
      case 86400:
        timeLabelFunc = this.timeLabelAsDay;
        break;
      case null:
        timeLabelFunc = this.timeLabelAsFull;
        break;
      default:
        timeLabelFunc = this.timeLabelAsRange.bind(this, interval);
    }

    var children = points.map((point, pointIdx) => {
      var pct = this.floatFormat(point.y / maxval * 99, 2) + "%";

      return jQuery(
        '<a style="width:' + pointWidth + '">' +
          '<span style="height:' + pct + '">' + point.y + '</span>' +
        '</a>'
      ).tooltip({
        html: true,
        placement: this.props.placement,
        title: () => {
          var timeLabel = timeLabelFunc(point);
          var title = (
            '<div style="width:130px">' +
              point.y + ' ' + this.props.label + '<br/>' +
              timeLabel +
            '</div>'
          );
          if (point.label) {
            title += '<div>(' + point.label + ')</div>';
          }
          return title;
        },
        viewport: this.props.viewport
      });
    });

    jQuery(this.refs.chartPoints.getDOMNode()).html(children);
  },

  render() {
    var maxval = 10;
    this.props.points.forEach((point) => {
      if (point.y > maxval) {
        maxval = point.y;
      }
    });

    return (
      <figure className={this.props.className || '' + ' barchart'}
              height={this.props.height}
              width={this.props.width}>
        <span className="max-y" key="max-y">{maxval}</span>
        <span className="min-y" key="min-y">{0}</span>
        <span ref="chartPoints" />
      </figure>
    );
  }
});

module.exports = BarChart;
