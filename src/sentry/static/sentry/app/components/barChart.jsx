/*** @jsx React.DOM */
var React = require("react");

var OverlayTrigger = require("./OverlayTrigger");
var Tooltip = require("./Tooltip");

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

  getDefaultProps(){
    return {
      placement: "bottom"
    };
  },

  floatFormat(number, places) {
      var multi = Math.pow(10, places);
      return parseInt(number * multi, 10) / multi;
  },

  timeLabelAsHour(point) {
    var timeMoment = moment(point.x * 1000);
    var nextMoment = timeMoment.clone().add(59, "minute");

    return (
      <span>
        {timeMoment.format("LL")}<br />
        {timeMoment.format("LT")} &mdash;&rsaquo; {nextMoment.format("LT")}
      </span>
    );
  },

  timeLabelAsRange(interval, point) {
    var timeMoment = moment(point.x * 1000);
    var nextMoment = timeMoment.clone().add(interval - 1, "second");

    return (
      <span>
        {timeMoment.format("lll")}<br />
        &mdash;&rsaquo; {nextMoment.format("lll")}
      </span>
    );
  },

  timeLabelAsFull(point) {
    var timeMoment = moment(point.x * 1000);
    return timeMoment.format("lll");
  },

  render(){
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

    var children = points.map((point, pointIdx) => {
      var pct = this.floatFormat(point.y / maxval * 99, 2) + "%";
      var timeLabel = timeLabelFunc(point);

      var title = (
        <div style={{minWidth: 200}}>
          {point.y} events<br/>
          {timeLabel}
        </div>
      );
      if (point.label) {
        title += <div>({point.label})</div>;
      }

      var tooltip = (
        <Tooltip>
          {title}
        </Tooltip>
      );

      return (
        <OverlayTrigger overlay={tooltip}
                        placement={this.props.placement}
                        key={point.x}>
          <a style={{width: pointWidth}}>
            <span style={{height: pct}}>{point.y}</span>
          </a>
        </OverlayTrigger>
      );
    });

    return (
      <figure className={this.props.className}>
        {children}
      </figure>
    );
  }
});

module.exports = BarChart;
