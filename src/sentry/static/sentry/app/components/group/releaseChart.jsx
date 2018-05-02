import PropTypes from 'prop-types';
import React from 'react';
import createReactClass from 'create-react-class';

import StackedBarChart from 'app/components/stackedBarChart';
import SentryTypes from 'app/proptypes';
import {t} from 'app/locale';
import {escape, intcomma} from 'app/utils';

const GroupReleaseChart = createReactClass({
  displayName: 'GroupReleaseChart',

  propTypes: {
    group: SentryTypes.Group.isRequired,
    release: PropTypes.shape({
      version: PropTypes.string.isRequired,
    }),
    statsPeriod: PropTypes.string.isRequired,
    environment: PropTypes.string,
    firstSeen: PropTypes.string,
    lastSeen: PropTypes.string,
    title: PropTypes.string,
  },

  getInitialState() {
    return this.getNextState(this.props);
  },

  componentWillReceiveProps(nextProps) {
    this.setState(this.getNextState(nextProps));
  },

  getNextState(props) {
    let releaseStats = props.releaseStats;
    let releasePoints = {};
    if (releaseStats) {
      releaseStats[props.statsPeriod].forEach(point => {
        releasePoints[point[0]] = point[1];
      });
    }

    let envStats = props.environmentStats;
    let envPoints = {};
    if (envStats) {
      envStats[props.statsPeriod].forEach(point => {
        envPoints[point[0]] = point[1];
      });
    }

    return {
      releasePoints,
      envPoints,
    };
  },

  renderTooltip(point, pointIdx, chart) {
    let timeLabel = chart.getTimeLabel(point);
    let totalY = 0;
    for (let i = 0; i < point.y.length; i++) {
      totalY += point.y[i];
    }

    let {environment, release} = this.props;
    let {releasePoints, envPoints} = this.state;

    return (
      '<div style="width:150px">' +
      `<div class="time-label">${timeLabel}</div>` +
      '<dl class="legend">' +
      '<dt class="inactive"><span></span></dt>' +
      `<dd>${intcomma(totalY)} event${totalY !== 1 ? 's' : ''}</dd>` +
      (environment
        ? '<dt class="environment"><span></span></dt>' +
          `<dd>${intcomma(envPoints[point.x] || 0)} event${envPoints[point.x] !== 1
            ? 's'
            : ''}` +
          `<small>in ${escape(environment)}</small></dd>`
        : '') +
      (release
        ? '<dt class="active"><span></span></dt>' +
          `<dd>${intcomma(releasePoints[point.x] || 0)} event${releasePoints[point.x] !==
          1
            ? 's'
            : ''}` +
          `<small>in ${escape(release.version.substr(0, 12))}</small></dd>`
        : '') +
      '</dl>' +
      '</div>'
    );
  },

  render() {
    let className = 'bar-chart group-chart ' + (this.props.className || '');

    let group = this.props.group;
    let stats = group.stats[this.props.statsPeriod];
    if (!stats || !stats.length) return null;

    let {releasePoints, envPoints} = this.state;

    let points = stats.map(point => {
      let rData = releasePoints[point[0]] || 0;
      let eData = (envPoints[point[0]] || 0) - rData;
      if (eData < 0) eData = 0;
      let remaining = point[1] - rData - eData;
      return {
        x: point[0],
        y: [rData, eData, remaining >= 0 ? remaining : 0],
      };
    });

    let markers = [];

    if (this.props.firstSeen) {
      let firstSeenX = new Date(this.props.firstSeen).getTime() / 1000;
      if (firstSeenX >= points[0].x) {
        markers.push({
          label: t('First seen'),
          x: firstSeenX,
          className: 'first-seen',
        });
      }
    }

    if (this.props.lastSeen) {
      let lastSeenX = new Date(this.props.lastSeen).getTime() / 1000;
      if (lastSeenX >= points[0].x) {
        markers.push({
          label: t('Last seen'),
          x: lastSeenX,
          className: 'last-seen',
        });
      }
    }

    return (
      <div className={className}>
        <h6>
          <span>{this.props.title}</span>
        </h6>
        <StackedBarChart
          points={points}
          height={40}
          label={t('events')}
          markers={markers}
          barClasses={['release', 'environment', 'inactive']}
          tooltip={this.renderTooltip}
        />
      </div>
    );
  },
});

export default GroupReleaseChart;
