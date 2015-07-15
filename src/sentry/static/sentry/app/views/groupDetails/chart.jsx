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
    if (this.props.firstSeen >= points[0].x) {
      markers.push({
        label: "First seen",
        x: new Date(this.props.firstSeen).getTime() / 1000,
        className: "first-seen"
      });
    }
    markers.push({
      label: "Last seen",
      x: new Date(this.props.lastSeen).getTime() / 1000,
      className: "last-seen"
    });

    return (
      <div className={className}>
        <h6>{this.props.title}</h6>
        <BarChart
            points={points}
            markers={markers}
            className="sparkline" />
      </div>
    );
  }

});

module.exports = GroupChart;
