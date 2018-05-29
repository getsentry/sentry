import PropTypes from 'prop-types';
import React from 'react';
import createReactClass from 'create-react-class';
import DateTime from 'app/components/dateTime';
import TimeSince from 'app/components/timeSince';
import Version from 'app/components/version';
import VersionHoverCard from 'app/components/versionHoverCard';
import Tooltip from 'app/components/tooltip';
import {defined, toTitleCase} from 'app/utils';
import componentToString from 'app/utils/componentToString';
import {t} from 'app/locale';

const SeenInfo = createReactClass({
  displayName: 'SeenInfo',

  propTypes: {
    orgId: PropTypes.string.isRequired,
    projectId: PropTypes.string.isRequired,
    date: PropTypes.any,
    dateGlobal: PropTypes.any,
    release: PropTypes.shape({
      version: PropTypes.string.isRequired,
    }),
    environment: PropTypes.string,
    hasRelease: PropTypes.bool.isRequired,
    title: PropTypes.string.isRequired,
  },

  contextTypes: {
    organization: PropTypes.object,
  },

  shouldComponentUpdate(nextProps, nextState) {
    return (
      (this.props.release || {}).version !== (nextProps.release || {}).version ||
      this.props.date !== nextProps.date
    );
  },

  getReleaseTrackingUrl() {
    let {orgId, projectId} = this.props;

    return `/${orgId}/${projectId}/settings/release-tracking/`;
  },

  getTooltipTitle() {
    let {date, dateGlobal, environment, title} = this.props;

    return componentToString(
      <div style={{width: 170}}>
        <div className="time-label">{title}</div>
        <dl className="flat">
          {environment && [
            <dt key="0">{toTitleCase(environment)}</dt>,
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
  },

  render() {
    let {date, dateGlobal, environment, release, orgId, projectId} = this.props;
    return (
      <dl className="seen-info">
        <dt key={0}>{t('When')}:</dt>
        {date ? (
          <dd key={1}>
            <Tooltip title={this.getTooltipTitle} tooltipOptions={{html: true}}>
              <span>
                <TimeSince className="dotted-underline" date={date} />
              </span>
            </Tooltip>
            <br />
            <small>
              <DateTime date={date} seconds={true} />
            </small>
          </dd>
        ) : dateGlobal && environment === '' ? (
          <dd key={1}>
            <Tooltip title={this.getTooltipTitle()} tooltipOptions={{html: true}}>
              <span>
                <TimeSince date={dateGlobal} />
              </span>
            </Tooltip>
            <br />
            <small>
              <DateTime date={dateGlobal} seconds={true} />
            </small>
          </dd>
        ) : (
          <dd key={1}>{t('n/a')}</dd>
        )}
        <dt key={4}>{t('Release')}:</dt>
        {defined(release) ? (
          <dd key={5}>
            <VersionHoverCard
              orgId={orgId}
              projectId={projectId}
              version={release.version}
            >
              <Version orgId={orgId} projectId={projectId} version={release.version} />
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
  },
});

export default SeenInfo;
