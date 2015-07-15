var $ = require("jquery");
var moment = require("moment");
var React = require("react");

var TooltipTrigger = require("./tooltipTrigger");
var { valueIsEqual } = require("../utils");

var BarChart = React.createClass({
  propTypes: {
    points: React.PropTypes.arrayOf(React.PropTypes.shape({
      x: React.PropTypes.number.isRequired,
      y: React.PropTypes.number.isRequired,
      label: React.PropTypes.string
    })),
    interval: React.PropTypes.string,
    placement: React.PropTypes.string,
    label: React.PropTypes.string,
    markers: React.PropTypes.arrayOf(React.PropTypes.shape({
      x: React.PropTypes.number.isRequired,
      y: React.PropTypes.number.isRequired,
      label: React.PropTypes.string
    }))
  },

  getDefaultProps() {
    return {
      className: "",
      height: null,
      label: "events",
      placement: "bottom",
      points: [],
      width: null,
      viewport: null
    };
  },

  componentDidMount() {
    this.attachTooltips();
  },

  componentWillUnmount() {
    this.removeTooltips();
    $(this.getDOMNode()).unbind();
  },

  shouldComponentUpdate(nextProps, nextState) {
    return !valueIsEqual(this.props, nextProps, true);
  },

  attachTooltips() {
    $(this.getDOMNode()).tooltip({
      html: true,
      placement: this.props.placement,
      selector: ".tip",
      viewport: this.props.viewport
    });
  },

  removeTooltips() {
    $(this.getDOMNode()).tooltip("destroy");
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

  maxPointValue() {
    var maxval = 10;
    this.props.points.forEach((point) => {
      if (point.y > maxval) {
        maxval = point.y;
      }
    });
    return maxval;
  },

  renderMarker(marker) {
    var timeLabel = moment(marker.x * 1000).format("lll");
    var title = (
      '<div style="width:130px">' +
        marker.label + '<br/>' +
        timeLabel +
      '</div>'
    );
    var className = "chart-marker tip " + (marker.className || '');

    return (
      <a key={'m' + marker.x} className={className} data-title={title}>
        <span>{marker.label}</span>
      </a>
    );
  },

  renderChartColumn(point, maxval, timeLabelFunc, pointWidth) {
    var pct = this.floatFormat(point.y / maxval * 99, 2) + "%";
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

    return (
      <a key={point.x} className="chart-column tip" data-title={title} style={{ width: pointWidth }}>
        <span style={{ height: pct }}>{point.y}</span>
      </a>
    );
  },

  renderChart() {
    var points = this.props.points;
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

    var maxval = this.maxPointValue();

    var markers = this.props.markers.slice();

    var children = [];
    var lastX = 0;
    points.forEach((point, pointIdx) => {
      markers.forEach((marker, markerIdx) => {
        if (marker.x > lastX && marker.x <= point.x) {
          markers.splice(markerIdx, 1);
          children.push(this.renderMarker(marker));
        }
      });
      children.push(this.renderChartColumn(point, maxval, timeLabelFunc, pointWidth));
      lastX = point.x;
    });

    markers.forEach((marker) => {
      children.push(this.renderMarker(marker));
    });

    return children;
  },

  render() {
    var figureClass = [this.props.className, 'barchart'].join(" ");
    var maxval = this.maxPointValue();

    return (
      <figure className={figureClass} height={this.props.height} width={this.props.width}>
        <span className="max-y">{maxval}</span>
        <span className="min-y">0</span>
        <span>{this.renderChart()}</span>
      </figure>
    );
  }
});

module.exports = BarChart;
