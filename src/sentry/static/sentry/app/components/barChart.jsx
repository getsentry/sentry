import moment from "moment";
import React from "react";
import { valueIsEqual } from "../utils";
import TooltipMixin from "../mixins/tooltip";

var BarChart = React.createClass({
  mixins: [
    TooltipMixin(function () {
      return {
        html: true,
        placement: this.props.placement,
        selector: ".tip",
        viewport: this.props.viewport
      };
    })
  ],

  propTypes: {
    points: React.PropTypes.arrayOf(React.PropTypes.shape({
      x: React.PropTypes.number.isRequired,
      y: React.PropTypes.number.isRequired,
      label: React.PropTypes.string
    })),
    placement: React.PropTypes.string,
    label: React.PropTypes.string,
    markers: React.PropTypes.arrayOf(React.PropTypes.shape({
      x: React.PropTypes.number.isRequired,
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
      markers: [],
      width: null,
      viewport: null
    };
  },

  shouldComponentUpdate(nextProps, nextState) {
    return !valueIsEqual(this.props, nextProps, true);
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
        timeMoment.format("LT") + '  &#8594; ' + nextMoment.format("LT") +
      '</span>'
    );
  },

  timeLabelAsDay(point) {
    var timeMoment = moment(point.x * 1000);

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
        // e.g. Aug 23rd, 12:50 pm
        timeMoment.format("MMM Do, h:mm a") +
        ' &#8594 ' + nextMoment.format("MMM Do, h:mm a") +
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

    // example key: m-last-seen-22811123, m-first-seen-228191
    var key = ['m', marker.className, marker.x].join('-');

    return (
      <a key={key} className={className} data-title={title}>
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
    points.forEach((point, pointIdx) => {
      while(markers.length && markers[0].x <= point.x) {
        children.push(this.renderMarker(markers.shift()));
      }

      children.push(this.renderChartColumn(point, maxval, timeLabelFunc, pointWidth));
    });

    // in bizarre case where markers never got rendered, render them last
    // NOTE: should this ever happen?
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

export default BarChart;
