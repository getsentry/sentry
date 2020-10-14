import React from 'react';
import styled from '@emotion/styled';
import PropTypes from 'prop-types';

import DateTime from 'app/components/dateTime';
import TimeSince from 'app/components/timeSince';
import Version from 'app/components/version';
import VersionHoverCard from 'app/components/versionHoverCard';
import space from 'app/styles/space';
import Tooltip from 'app/components/tooltip';
import {defined, toTitleCase} from 'app/utils';
import {t} from 'app/locale';
import {Release} from 'app/types';

type RelaxedDateType = React.ComponentProps<typeof TimeSince>['date'];

type Props = {
  orgSlug: string;
  projectSlug: string;
  projectId: string;
  hasRelease: boolean;
  title: string;
  date: RelaxedDateType;
  dateGlobal: RelaxedDateType;
  release?: Release;
  environment?: string;
};

class SeenInfo extends React.Component<Props> {
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

  shouldComponentUpdate(nextProps: Props) {
    const {date, release} = this.props;

    return release?.version !== nextProps.release?.version || date !== nextProps.date;
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
        {environment && (
          <React.Fragment>
            {toTitleCase(environment)}
            {': '}
            <TimeSince date={date} />
            <br />
          </React.Fragment>
        )}
        {t('Globally: ')}
        <TimeSince date={dateGlobal} />
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
              <TimeSince date={date} />
            </Tooltip>
          </TooltipWrapper>
        ) : dateGlobal && environment === '' ? (
          <React.Fragment>
            <Tooltip title={this.getTooltipTitle()} disableForVisualTest>
              <TimeSince date={dateGlobal} />
            </Tooltip>
          </React.Fragment>
        ) : (
          <React.Fragment>{t('n/a')} </React.Fragment>
        )}
        {defined(release) ? (
          <React.Fragment>
            {t('in release ')}
            <VersionHoverCard
              orgSlug={orgSlug}
              projectSlug={projectSlug}
              releaseVersion={release.version}
            >
              <span>
                <Version version={release.version} truncate projectId={projectId} />
              </span>
            </VersionHoverCard>
          </React.Fragment>
        ) : !this.props.hasRelease ? (
          <React.Fragment>
            <NotConfigured>
              <a href={this.getReleaseTrackingUrl()}>{t('Releases not configured')}</a>
            </NotConfigured>
          </React.Fragment>
        ) : (
          <React.Fragment>{t('Release n/a')}</React.Fragment>
        )}
        <StyledDateTime date={date} seconds />
      </DateWrapper>
    );
  }
}

const NotConfigured = styled('span')`
  margin-left: ${space(0.25)};
`;

const StyledDateTime = styled(DateTime)`
  display: block;
  font-size: ${p => p.theme.fontSizeSmall};
  color: ${p => p.theme.gray500};
`;

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

  a {
    display: inline;
  }
`;

export default SeenInfo;
