import React from 'react';
import BarChart from '../../components/barChart';
import PropTypes from '../../proptypes';
import PureRenderMixin from 'react-addons-pure-render-mixin';

const GroupChart = React.createClass({
  propTypes: {
    group: PropTypes.Group.isRequired,
    statsPeriod: React.PropTypes.string.isRequired
  },

  mixins: [PureRenderMixin],

  render: function() {
    let group = this.props.group;
    let stats = group.stats[this.props.statsPeriod];
    let points = stats.map((point) => {
      return {x: point[0], y: point[1]};
    });
    let className = 'bar-chart group-chart ' + (this.props.className || '');

    let markers = [];
    let firstSeenX = new Date(this.props.firstSeen).getTime() / 1000;
    let lastSeenX = new Date(this.props.lastSeen).getTime() / 1000;
    if (firstSeenX >= points[0].x) {
      markers.push({
        label: 'First seen',
        x: firstSeenX,
        className: 'first-seen'
      });
    }
    if (lastSeenX >= points[0].x) {
      markers.push({
        label: 'Last seen',
        x: lastSeenX,
        className: 'last-seen'
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

export default GroupChart;

