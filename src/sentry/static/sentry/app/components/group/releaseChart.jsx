import React from 'react';

import StackedBarChart from '../stackedBarChart';
import PropTypes from '../../proptypes';
import {t} from '../../locale';
import {defined, intcomma} from '../../utils';

const GroupReleaseChart = React.createClass({
  propTypes: {
    group: PropTypes.Group.isRequired,
    release: React.PropTypes.shape({
      version: React.PropTypes.string.isRequired,
    }),
    releaseStats: React.PropTypes.object,
    statsPeriod: React.PropTypes.string.isRequired,
    environment: React.PropTypes.string,
    firstSeen: React.PropTypes.string,
    lastSeen: React.PropTypes.string,
    title: React.PropTypes.string
  },

  shouldComponentUpdate(nextProps, nextState) {
    return (
      // environment comes from grouprelease, so we can hack
      this.props.environment !== nextProps.environment ||
      this.props.group.id !== nextProps.group.id
    );
  },

  renderTooltip(point, pointIdx, chart) {
    let timeLabel = chart.getTimeLabel(point);
    let totalY = 0;
    for (let i = 0; i < point.y.length; i++) {
      totalY += point.y[i];
    }

    let title = '';
    if (defined(this.props.release)) {
      let version = this.props.release.version;
      let shortVersion = version.match(/^[a-f0-9]{40}$/) ? version.substr(0, 12) : version;
      title = (
        '<div style="width:150px">' +
          `${intcomma(totalY)} events<br/>` +
          `<small>${intcomma(point.y[0])} in ${shortVersion}</small><br/>` +
          timeLabel +
        '</div>'
      );
    } else {
      title = (
        '<div style="width:150px">' +
          `${intcomma(totalY)} events<br/>` +
          timeLabel +
        '</div>'
      );
    }
    return title;
  },

  render() {
    let className = 'bar-chart group-chart ' + (this.props.className || '');

    let group = this.props.group;
    let stats = group.stats[this.props.statsPeriod];
    if (!stats || !stats.length) return null;

    let releaseStats = this.props.releaseStats;
    let releasePoints = {};
    if (defined(releaseStats)) {
      releaseStats[this.props.statsPeriod].forEach((point) => {
        releasePoints[point[0]] = point[1];
      });
    }

    let points = stats.map((point) => {
      let rData = releasePoints[point[0]] || 0;
      let remaining = point[1] - rData;
      return {
        x: point[0],
        y: [
          rData,
          remaining >= 0 ? remaining : 0,
        ],
      };
    });

    let markers = [];

    if (this.props.firstSeen) {
      let firstSeenX = new Date(this.props.firstSeen).getTime() / 1000;
      if (firstSeenX >= points[0].x) {
        markers.push({
          label: t('First seen'),
          x: firstSeenX,
          className: 'first-seen'
        });
      }
    }

    if (this.props.lastSeen) {
      let lastSeenX = new Date(this.props.lastSeen).getTime() / 1000;
      if (lastSeenX >= points[0].x) {
        markers.push({
          label: t('Last seen'),
          x: lastSeenX,
          className: 'last-seen'
        });
      }
    }

    return (
      <div className={className}>
        <h6><span>{this.props.title}</span></h6>
        <StackedBarChart
          points={points}
          height={150}
          className="sparkline"
          markers={markers}
          barClasses={['active', 'inactive']}
          tooltip={this.renderTooltip} />
      </div>
    );
  }
});

export default GroupReleaseChart;
