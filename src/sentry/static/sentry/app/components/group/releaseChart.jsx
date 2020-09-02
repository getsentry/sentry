import PropTypes from 'prop-types';
import React from 'react';

import StackedBarChart from 'app/components/stackedBarChart';
import SentryTypes from 'app/sentryTypes';
import {t} from 'app/locale';
import {intcomma} from 'app/utils';
import theme from 'app/utils/theme';

class GroupReleaseChart extends React.Component {
  static propTypes = {
    group: SentryTypes.Group.isRequired,
    release: PropTypes.shape({
      version: PropTypes.string.isRequired,
    }),
    statsPeriod: PropTypes.string.isRequired,
    environment: PropTypes.string,
    firstSeen: PropTypes.string,
    lastSeen: PropTypes.string,
    title: PropTypes.string,
  };

  constructor(...args) {
    super(...args);
    this.state = this.getNextState(this.props);
  }

  UNSAFE_componentWillReceiveProps(nextProps) {
    this.setState(this.getNextState(nextProps));
  }

  getNextState(props) {
    const releaseStats = props.releaseStats;
    const releasePoints = {};
    if (releaseStats) {
      releaseStats[props.statsPeriod].forEach(point => {
        releasePoints[point[0]] = point[1];
      });
    }

    const envStats = props.environmentStats;
    const envPoints = {};
    if (envStats) {
      envStats[props.statsPeriod]?.forEach(point => {
        envPoints[point[0]] = point[1];
      });
    }

    return {
      releasePoints,
      envPoints,
    };
  }

  renderTooltip = (point, _pointIdx, chart) => {
    const timeLabel = chart.getTimeLabel(point);
    let totalY = 0;
    for (let i = 0; i < point.y.length; i++) {
      totalY += point.y[i];
    }

    const {environment, release} = this.props;
    const {releasePoints, envPoints} = this.state;

    return (
      <div style={{width: '150px'}}>
        <div className="time-label">{timeLabel}</div>
        <dl className="legend">
          <dt className="inactive">
            <span />
          </dt>
          <dd>
            {intcomma(totalY)} event{totalY !== 1 ? 's' : ''}
          </dd>
          {environment && (
            <React.Fragment>
              <dt className="environment">
                <span />
              </dt>
              <dd>
                {intcomma(envPoints[point.x] || 0)} event
                {envPoints[point.x] !== 1 ? 's' : ''}
                <small>in {environment}</small>
              </dd>
            </React.Fragment>
          )}
          {release && (
            <React.Fragment>
              <dt className="active">
                <span />
              </dt>
              <dd>
                {intcomma(releasePoints[point.x] || 0)} event
                {releasePoints[point.x] !== 1 ? 's' : ''}
                <small>in {release.version.substr(0, 12)}</small>
              </dd>
            </React.Fragment>
          )}
        </dl>
      </div>
    );
  };

  render() {
    const className = 'bar-chart group-chart ' + (this.props.className || '');

    const group = this.props.group;
    const stats = group.stats[this.props.statsPeriod];
    if (!stats || !stats.length) {
      return null;
    }

    const {releasePoints, envPoints} = this.state;

    const points = stats.map(point => {
      const rData = releasePoints[point[0]] || 0;
      let eData = (envPoints[point[0]] || 0) - rData;
      if (eData < 0) {
        eData = 0;
      }
      const remaining = point[1] - rData - eData;
      return {
        x: point[0],
        y: [rData, eData, remaining >= 0 ? remaining : 0],
      };
    });

    const markers = [];

    if (this.props.firstSeen) {
      const firstSeenX = new Date(this.props.firstSeen).getTime() / 1000;
      if (firstSeenX >= points[0].x) {
        markers.push({
          label: t('First seen'),
          x: firstSeenX,
          className: 'first-seen',
          offset: -7.5,
          fill: theme.pink400,
        });
      }
    }

    if (this.props.lastSeen) {
      const lastSeenX = new Date(this.props.lastSeen).getTime() / 1000;
      if (lastSeenX >= points[0].x) {
        markers.push({
          label: t('Last seen'),
          x: lastSeenX,
          className: 'last-seen',
          fill: theme.green400,
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
          gap={0.75}
          minHeights={[0, 0, 5]}
        />
      </div>
    );
  }
}

export default GroupReleaseChart;
