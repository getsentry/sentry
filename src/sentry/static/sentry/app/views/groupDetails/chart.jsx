var React = require("react");

var BarChart = require("../../components/barChart");
var PropTypes = require("../../proptypes");
var PureRenderMixin = require('react/addons').addons.PureRenderMixin;

var GroupChart = React.createClass({
  mixins: [PureRenderMixin],

  propTypes: {
    group: PropTypes.Group.isRequired,
    statsPeriod: React.PropTypes.string.isRequired
  },

  render: function() {
    var group = this.props.group;
    var stats = group.stats[this.props.statsPeriod];
    var points = stats.map((point) => {
      return {x: point[0], y: point[1]};
    });
    var className = "bar-chart group-chart " + (this.props.className || '');

    var markers = [];
    var firstSeenX = new Date(this.props.firstSeen).getTime() / 1000;
    var lastSeenX = new Date(this.props.lastSeen).getTime() / 1000;
    if (firstSeenX >= points[0].x) {
      markers.push({
        label: "First seen",
        x: firstSeenX,
        className: "first-seen"
      });
    }
    if (lastSeenX >= points[0].x) {
      markers.push({
        label: "Last seen",
        x: lastSeenX,
        className: "last-seen"
      });
    }

    return (
      <div className={className}>
        <h6><span>{this.props.title}</span></h6>
        <BarChart
            points={points}
            markers={markers}
            className="sparkline" />
      </div>
    );
  }

});

module.exports = GroupChart;
