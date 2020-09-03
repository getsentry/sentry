import PropTypes from 'prop-types';
import React from 'react';

import DateTime from 'app/components/dateTime';
import TimeSince from 'app/components/timeSince';
import Version from 'app/components/version';
import VersionHoverCard from 'app/components/versionHoverCard';
import Tooltip from 'app/components/tooltip';
import {defined, toTitleCase} from 'app/utils';
import {t} from 'app/locale';

class SeenInfo extends React.Component {
  static propTypes = {
    orgSlug: PropTypes.string.isRequired,
    projectSlug: PropTypes.string.isRequired,
    projectId: PropTypes.string.isRequired,
    date: PropTypes.any,
    dateGlobal: PropTypes.any,
    release: PropTypes.shape({
      version: PropTypes.string.isRequired,
    }),
    environment: PropTypes.string,
    hasRelease: PropTypes.bool.isRequired,
    title: PropTypes.string.isRequired,
  };

  static contextTypes = {
    organization: PropTypes.object,
  };

  shouldComponentUpdate(nextProps, _nextState) {
    return (
      (this.props.release || {}).version !== (nextProps.release || {}).version ||
      this.props.date !== nextProps.date
    );
  }

  getReleaseTrackingUrl() {
    const {orgSlug, projectSlug} = this.props;

    return `/settings/${orgSlug}/projects/${projectSlug}/release-tracking/`;
  }

  getTooltipTitle() {
    const {date, dateGlobal, title, environment} = this.props;

    return (
      <div style={{width: '170px'}}>
        <div className="time-label">{title}</div>
        <dl className="flat">
          {environment && [
            <dt key="0">{toTitleCase(environment)}:</dt>,
            <dd key="0.1">
              <TimeSince date={date} />
              <br />
            </dd>,
          ]}
          <dt key="1">{t('Globally:')}</dt>
          <dd key="1.1">
            <TimeSince date={dateGlobal} />
            <br />
          </dd>
        </dl>
      </div>
    );
  }

  render() {
    const {
      date,
      dateGlobal,
      environment,
      release,
      orgSlug,
      projectSlug,
      projectId,
    } = this.props;
    return (
      <dl className="seen-info">
        <dt key={0}>{t('When')}:</dt>
        {date ? (
          <dd key={1}>
            <Tooltip title={this.getTooltipTitle()} disableForVisualTest>
              <TimeSince className="dotted-underline" date={date} />
            </Tooltip>
            <br />
            <small>
              <DateTime date={date} seconds />
            </small>
          </dd>
        ) : dateGlobal && environment === '' ? (
          <dd key={1}>
            <Tooltip title={this.getTooltipTitle()} disableForVisualTest>
              <TimeSince date={dateGlobal} />
            </Tooltip>
            <br />
            <small>
              <DateTime date={dateGlobal} seconds />
            </small>
          </dd>
        ) : (
          <dd key={1}>{t('n/a')}</dd>
        )}
        <dt key={4}>{t('Release')}:</dt>
        {defined(release) ? (
          <dd key={5}>
            <VersionHoverCard
              orgSlug={orgSlug}
              projectSlug={projectSlug}
              releaseVersion={release.version}
            >
              <Version version={release.version} truncate projectId={projectId} />
            </VersionHoverCard>
          </dd>
        ) : !this.props.hasRelease ? (
          <dd key={5}>
            <small style={{marginLeft: 5, fontStyle: 'italic'}}>
              <a href={this.getReleaseTrackingUrl()}>{t('not configured')}</a>
            </small>
          </dd>
        ) : (
          <dd key={5}>{t('n/a')}</dd>
        )}
      </dl>
    );
  }
}

export default SeenInfo;
