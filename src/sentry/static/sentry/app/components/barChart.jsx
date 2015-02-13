/*** @jsx React.DOM */
var React = require("react");

var OverlayTrigger = require("react-bootstrap/OverlayTrigger");
var Tooltip = require("react-bootstrap/Tooltip");

var BarChart = React.createClass({
  propTypes: {
    points: React.PropTypes.arrayOf(React.PropTypes.shape({
      x: React.PropTypes.number.isRequired,
      y: React.PropTypes.number.isRequired,
      label: React.PropTypes.string
    })),
    interval: React.PropTypes.string,
    placement: React.PropTypes.string
  },

  getDefaultProps: function(){
    return {
      placement: "bottom"
    };
  },

  floatFormat: function(number, places) {
      var multi = Math.pow(10, places);
      return parseInt(number * multi, 10) / multi;
  },

  timeLabelAsHour: function(point) {
    var timeMoment = moment(point.x * 1000);
    var nextMoment = timeMoment.clone().add(59, "minute");

    return (
      <span>
        {timeMoment.format("LL")}<br />
        {timeMoment.format("LT")} &mdash;&rsaquo; {nextMoment.format("LT")}
      </span>
    );
  },

  timeLabelAsRange: function(interval, point) {
    var timeMoment = moment(point.x * 1000);
    var nextMoment = timeMoment.clone().add(interval - 1, "second");

    return (
      <span>
        {timeMoment.format("lll")}<br />
        &mdash;&rsaquo; {nextMoment.format("lll")}
      </span>
    );
  },

  timeLabelAsFull: function(point) {
    var timeMoment = moment(point.x * 1000);
    return timeMoment.format("lll");
  },

  render: function(){
    // TODO: maxval could default to # of hours since first_seen / times_seen
    var points = this.props.points;

    var maxval = 10;
    points.forEach(function(point){
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
      case null:
        timeLabelFunc = this.timeLabelAsFull;
        break;
      default:
        timeLabelFunc = this.timeLabelAsRange.bind(this, interval);
    }

    var children = [];
    points.forEach(function(point, pointIdx){
      var pct = this.floatFormat(point.y / maxval * 99, 2) + "%";
      var timeLabel = timeLabelFunc(point);

      var title = (
        <div>
          {point.y} events<br/>
          {timeLabel}
        </div>
      );
      if (point.label) {
        title += <div>({point.label})</div>;
      }

      children.push((
        <OverlayTrigger overlay={<Tooltip>{title}</Tooltip>}
                        placement={this.props.placement}
                        key={point.x}>
          <a style={{width: pointWidth}}>
            <span style={{height: pct}}>{point.y}</span>
          </a>
        </OverlayTrigger>
      ));
        // $("<a style="width:" + pointWidth + ";" rel="tooltip" title="" + title + ""><span style="height:" + pct + "">" + point.y + "</span></a>").tooltip({
        //   placement: options.placement || "bottom",
        //   html: true,
        //   container: "body"
        // }).appendTo($el);
    }.bind(this));

    return (
      <figure className={this.props.className}>
        {children}
      </figure>
    );
  }
});

module.exports = BarChart;
