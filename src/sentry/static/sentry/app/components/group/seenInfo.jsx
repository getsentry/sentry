import React from 'react';
import styled from '@emotion/styled';
import PropTypes from 'prop-types';

import DateTime from 'app/components/dateTime';
import TimeSince from 'app/components/timeSince';
import Version from 'app/components/version';
import VersionHoverCard from 'app/components/versionHoverCard';
import space from 'app/styles/space';
import {IconInfo} from 'app/icons';
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
        <div className="time-label" style={{marginBottom: '10px'}}>
          {title}
        </div>
        {environment && [
          <React.Fragment key="0">{toTitleCase(environment)}: </React.Fragment>,
          <React.Fragment key="0.1">
            <TimeSince date={date} />
            <br />
            <DateTime date={date} seconds />
          </React.Fragment>,
        ]}
        <div>{t('Globally: ')}</div>
        <TimeSince date={dateGlobal} />
        <br />
        <DateTime date={date} seconds />
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
      <DateWrapper>
        {date ? (
          <TooltipWrapper>
            <Tooltip title={this.getTooltipTitle()} disableForVisualTest>
              <IconInfo size="xs" color="gray500" />
              <TimeSince className="dotted-underline" date={date} />
            </Tooltip>
          </TooltipWrapper>
        ) : dateGlobal && environment === '' ? (
          <React.Fragment>
            <Tooltip title={this.getTooltipTitle()} disableForVisualTest>
              <TimeSince date={dateGlobal} />
            </Tooltip>
            <br />
            <small>
              <DateTime date={dateGlobal} seconds />
            </small>
          </React.Fragment>
        ) : (
          <React.Fragment>{t('n/a')} </React.Fragment>
        )}
        {defined(release) ? (
          <React.Fragment>
            <VersionHoverCard
              orgSlug={orgSlug}
              projectSlug={projectSlug}
              releaseVersion={release.version}
            >
              {t('in release ')}
              <span>
                <Version version={release.version} truncate projectId={projectId} />
              </span>
            </VersionHoverCard>
          </React.Fragment>
        ) : !this.props.hasRelease ? (
          <React.Fragment>
            <small style={{marginLeft: 5}}>
              <a href={this.getReleaseTrackingUrl()}>{t('Releases not configured')}</a>
            </small>
          </React.Fragment>
        ) : (
          <React.Fragment>{t('n/a')}</React.Fragment>
        )}
      </DateWrapper>
    );
  }
}

const DateWrapper = styled('div')`
  margin-bottom: ${space(2)};
`;

const TooltipWrapper = styled('span')`
  margin-right: ${space(0.25)};
  svg {
    margin-right: ${space(0.5)};
    position: relative;
    top: 1px;
  }
`;

export default SeenInfo;
