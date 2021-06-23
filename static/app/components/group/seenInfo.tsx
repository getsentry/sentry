import * as React from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';

import DateTime from 'app/components/dateTime';
import {Body, Header, Hovercard} from 'app/components/hovercard';
import TimeSince from 'app/components/timeSince';
import Version from 'app/components/version';
import VersionHoverCard from 'app/components/versionHoverCard';
import {t} from 'app/locale';
import overflowEllipsis from 'app/styles/overflowEllipsis';
import space from 'app/styles/space';
import {Organization, Release} from 'app/types';
import {defined, toTitleCase} from 'app/utils';
import theme from 'app/utils/theme';

type RelaxedDateType = React.ComponentProps<typeof TimeSince>['date'];

type Props = {
  organization: Organization;
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
  shouldComponentUpdate(nextProps: Props) {
    const {date, release} = this.props;

    return release?.version !== nextProps.release?.version || date !== nextProps.date;
  }

  getReleaseTrackingUrl() {
    const {organization, projectSlug} = this.props;
    const orgSlug = organization.slug;

    return `/settings/${orgSlug}/projects/${projectSlug}/release-tracking/`;
  }

  render() {
    const {date, dateGlobal, environment, release, organization, projectSlug, projectId} =
      this.props;

    return (
      <HovercardWrapper>
        <StyledHovercard
          header={
            <div>
              <TimeSinceWrapper>
                {t('Any Environment')}
                <TimeSince date={dateGlobal} disabledAbsoluteTooltip />
              </TimeSinceWrapper>
              {environment && (
                <TimeSinceWrapper>
                  {toTitleCase(environment)}
                  {date ? (
                    <TimeSince date={date} disabledAbsoluteTooltip />
                  ) : (
                    <span>{t('N/A')}</span>
                  )}
                </TimeSinceWrapper>
              )}
            </div>
          }
          body={
            date ? (
              <StyledDateTime date={date} />
            ) : (
              <NoEnvironment>{t(`N/A for ${environment}`)}</NoEnvironment>
            )
          }
          position="top"
          tipColor={theme.gray500}
        >
          <DateWrapper>
            {date ? (
              <TooltipWrapper>
                <StyledTimeSince date={date} disabledAbsoluteTooltip />
              </TooltipWrapper>
            ) : dateGlobal && environment === '' ? (
              <React.Fragment>
                <TimeSince date={dateGlobal} disabledAbsoluteTooltip />
                <StyledTimeSince date={dateGlobal} disabledAbsoluteTooltip />
              </React.Fragment>
            ) : (
              <NoDateTime>{t('N/A')}</NoDateTime>
            )}
          </DateWrapper>
        </StyledHovercard>
        <DateWrapper>
          {defined(release) ? (
            <React.Fragment>
              {t('in release ')}
              <VersionHoverCard
                organization={organization}
                projectSlug={projectSlug}
                releaseVersion={release.version}
              >
                <span>
                  <Version version={release.version} projectId={projectId} />
                </span>
              </VersionHoverCard>
            </React.Fragment>
          ) : null}
        </DateWrapper>
      </HovercardWrapper>
    );
  }
}

const dateTimeCss = p => css`
  color: ${p.theme.gray300};
  font-size: ${p.theme.fontSizeMedium};
  display: flex;
  justify-content: center;
`;

const HovercardWrapper = styled('div')`
  display: flex;
`;

const DateWrapper = styled('div')`
  margin-bottom: ${space(2)};
  ${overflowEllipsis};
`;

const StyledDateTime = styled(DateTime)`
  ${dateTimeCss};
`;

const NoEnvironment = styled('div')`
  ${dateTimeCss};
`;

const NoDateTime = styled('span')`
  margin-right: ${space(0.5)};
`;

const TooltipWrapper = styled('span')`
  margin-right: ${space(0.25)};
  svg {
    margin-right: ${space(0.5)};
    position: relative;
    top: 1px;
  }
`;

const TimeSinceWrapper = styled('div')`
  font-size: ${p => p.theme.fontSizeSmall};
  margin-bottom: ${space(0.5)};
  display: flex;
  justify-content: space-between;
`;

const StyledTimeSince = styled(TimeSince)`
  font-size: ${p => p.theme.fontSizeMedium};
`;

const StyledHovercard = styled(Hovercard)`
  width: 250px;
  font-weight: normal;
  border: 1px solid ${p => p.theme.gray500};
  background: ${p => p.theme.gray500};
  ${Header} {
    font-weight: normal;
    color: ${p => p.theme.white};
    background: ${p => p.theme.gray500};
    border-bottom: 1px solid ${p => p.theme.gray400};
  }
  ${Body} {
    padding: ${space(1.5)};
  }
`;

export default SeenInfo;
