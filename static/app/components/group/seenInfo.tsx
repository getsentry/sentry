import {Fragment} from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';

import {DateTime} from 'sentry/components/dateTime';
import {Body, Header, Hovercard} from 'sentry/components/hovercard';
import TimeSince from 'sentry/components/timeSince';
import Version from 'sentry/components/version';
import VersionHoverCard from 'sentry/components/versionHoverCard';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Organization} from 'sentry/types/organization';
import type {Release} from 'sentry/types/release';
import {defined} from 'sentry/utils';
import {toTitleCase} from 'sentry/utils/string/toTitleCase';

type RelaxedDateType = React.ComponentProps<typeof TimeSince>['date'];

type Props = {
  date: RelaxedDateType;
  dateGlobal: RelaxedDateType;
  organization: Organization;
  projectId: string;
  projectSlug: string;
  environment?: string;
  release?: Release;
};

function SeenInfo({
  date,
  dateGlobal,
  environment,
  release,
  organization,
  projectSlug,
  projectId,
}: Props) {
  return (
    <HovercardWrapper>
      <StyledHovercard
        showUnderline
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
            <NoEnvironment>{t('N/A for %s', environment)}</NoEnvironment>
          )
        }
        position="top"
      >
        <DateWrapper>
          {date ? (
            <TooltipWrapper>
              <StyledTimeSince date={date} disabledAbsoluteTooltip />
            </TooltipWrapper>
          ) : dateGlobal && environment === '' ? (
            <Fragment>
              <TimeSince date={dateGlobal} disabledAbsoluteTooltip />
              <StyledTimeSince date={dateGlobal} disabledAbsoluteTooltip />
            </Fragment>
          ) : (
            <NoDateTime>{t('N/A')}</NoDateTime>
          )}
        </DateWrapper>
      </StyledHovercard>
      <DateWrapper>
        {defined(release) && (
          <Fragment>
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
          </Fragment>
        )}
      </DateWrapper>
    </HovercardWrapper>
  );
}

const dateTimeCss = (p: any) => css`
  color: ${p.theme.gray300};
  font-size: ${p.theme.fontSizeMedium};
  display: flex;
  justify-content: center;
`;

const HovercardWrapper = styled('div')`
  display: flex;
  align-items: baseline;
`;

const DateWrapper = styled('div')`
  margin-bottom: 0;
  ${p => p.theme.overflowEllipsis};
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
  margin-bottom: ${space(0.5)};
  display: flex;
  justify-content: space-between;
`;

const StyledTimeSince = styled(TimeSince)`
  font-size: ${p => p.theme.fontSizeMedium};
  line-height: 1.2;
`;

const StyledHovercard = styled(Hovercard)`
  width: 250px;
  ${Header} {
    font-weight: ${p => p.theme.fontWeightNormal};
    border-bottom: 1px solid ${p => p.theme.innerBorder};
  }
  ${Body} {
    padding: ${space(1.5)};
  }
`;

export default SeenInfo;
