import {Fragment} from 'react';
import styled from '@emotion/styled';

import {SectionHeading} from 'sentry/components/charts/styles';
import {DateTime} from 'sentry/components/dateTime';
import Duration from 'sentry/components/duration';
import ProjectBadge from 'sentry/components/idBadge/projectBadge';
import LoadingError from 'sentry/components/loadingError';
import Pagination from 'sentry/components/pagination';
import {PanelTable} from 'sentry/components/panels/panelTable';
import Placeholder from 'sentry/components/placeholder';
import ShortId from 'sentry/components/shortId';
import {
  StatusIndicator,
  type StatusIndicatorProps,
} from 'sentry/components/statusIndicator';
import Text from 'sentry/components/text';
import {Tooltip} from 'sentry/components/tooltip';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {defined} from 'sentry/utils';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import {useUser} from 'sentry/utils/useUser';
import {QuickContextHovercard} from 'sentry/views/discover/table/quickContext/quickContextHovercard';
import {ContextType} from 'sentry/views/discover/table/quickContext/utils';
import type {Monitor, MonitorEnvironment} from 'sentry/views/monitors/types';
import {CheckInStatus} from 'sentry/views/monitors/types';
import {statusToText} from 'sentry/views/monitors/utils';
import {useMonitorChecks} from 'sentry/views/monitors/utils/useMonitorChecks';

type Props = {
  monitor: Monitor;
  monitorEnvs: MonitorEnvironment[];
};

export const checkStatusToIndicatorStatus: Record<
  CheckInStatus,
  StatusIndicatorProps['status']
> = {
  [CheckInStatus.OK]: 'success',
  [CheckInStatus.ERROR]: 'error',
  [CheckInStatus.IN_PROGRESS]: 'muted',
  [CheckInStatus.MISSED]: 'warning',
  [CheckInStatus.TIMEOUT]: 'error',
  [CheckInStatus.UNKNOWN]: 'muted',
};

const PER_PAGE = 10;

export function MonitorCheckIns({monitor, monitorEnvs}: Props) {
  const user = useUser();
  const location = useLocation();
  const organization = useOrganization();

  const {
    data: checkInList,
    getResponseHeader,
    isPending,
    isError,
  } = useMonitorChecks({
    orgSlug: organization.slug,
    projectSlug: monitor.project.slug,
    monitorIdOrSlug: monitor.slug,
    limit: PER_PAGE,
    expand: 'groups',
    environment: monitorEnvs.map(e => e.name),
    queryParams: {...location.query},
  });

  if (isError) {
    return <LoadingError />;
  }

  const emptyCell = <Text>{'\u2014'}</Text>;

  const hasMultiEnv = monitorEnvs.length > 1;

  const headers = [
    t('Status'),
    t('Started'),
    t('Duration'),
    t('Issues'),
    ...(hasMultiEnv ? [t('Environment')] : []),
    t('Expected At'),
  ];

  const customTimezone =
    monitor.config.timezone && monitor.config.timezone !== user.options.timezone;

  return (
    <Fragment>
      <SectionHeading>{t('Recent Check-Ins')}</SectionHeading>
      <PanelTable
        headers={headers}
        isEmpty={!isPending && checkInList.length === 0}
        emptyMessage={t('No check-ins have been recorded for this time period.')}
      >
        {isPending
          ? [...new Array(PER_PAGE)].map((_, i) => (
              <RowPlaceholder key={i}>
                <Placeholder height="2rem" />
              </RowPlaceholder>
            ))
          : checkInList.map(checkIn => (
              <Fragment key={checkIn.id}>
                <Status>
                  <StatusIndicator
                    status={checkStatusToIndicatorStatus[checkIn.status]}
                    tooltipTitle={tct('Check-in Status: [status]', {
                      status: statusToText[checkIn.status],
                    })}
                  />
                  <Text>{statusToText[checkIn.status]}</Text>
                </Status>
                {checkIn.status !== CheckInStatus.MISSED ? (
                  <div>
                    <Tooltip
                      disabled={!customTimezone}
                      title={
                        <DateTime
                          date={checkIn.dateCreated}
                          forcedTimezone={monitor.config.timezone ?? 'UTC'}
                          timeZone
                          seconds
                        />
                      }
                    >
                      <DateTime date={checkIn.dateCreated} timeZone seconds />
                    </Tooltip>
                  </div>
                ) : (
                  emptyCell
                )}
                {defined(checkIn.duration) ? (
                  <div>
                    <Tooltip title={<Duration exact seconds={checkIn.duration / 1000} />}>
                      <Duration seconds={checkIn.duration / 1000} />
                    </Tooltip>
                  </div>
                ) : (
                  emptyCell
                )}
                {checkIn.groups && checkIn.groups.length > 0 ? (
                  <IssuesContainer>
                    {checkIn.groups.map(({id, shortId}) => (
                      <QuickContextHovercard
                        dataRow={{
                          ['issue.id']: id,
                          issue: shortId,
                        }}
                        contextType={ContextType.ISSUE}
                        organization={organization}
                        key={id}
                      >
                        <StyledShortId
                          shortId={shortId}
                          avatar={
                            <ProjectBadge
                              project={monitor.project}
                              hideName
                              avatarSize={12}
                            />
                          }
                          to={`/organizations/${organization.slug}/issues/${id}/`}
                        />
                      </QuickContextHovercard>
                    ))}
                  </IssuesContainer>
                ) : (
                  emptyCell
                )}
                {!hasMultiEnv ? null : <div>{checkIn.environment}</div>}
                <div>
                  {checkIn.expectedTime ? (
                    <Tooltip
                      disabled={!customTimezone}
                      title={
                        <DateTime
                          date={checkIn.expectedTime}
                          forcedTimezone={monitor.config.timezone ?? 'UTC'}
                          timeZone
                          seconds
                        />
                      }
                    >
                      <Timestamp date={checkIn.expectedTime} timeZone seconds />
                    </Tooltip>
                  ) : (
                    emptyCell
                  )}
                </div>
              </Fragment>
            ))}
      </PanelTable>
      <Pagination pageLinks={getResponseHeader?.('Link')} />
    </Fragment>
  );
}

const Status = styled('div')`
  line-height: 1.1;
`;

const IssuesContainer = styled('div')`
  display: flex;
  flex-direction: column;
`;

const Timestamp = styled(DateTime)`
  color: ${p => p.theme.subText};
`;

const StyledShortId = styled(ShortId)`
  justify-content: flex-start;
`;

const RowPlaceholder = styled('div')`
  grid-column: 1 / -1;
  padding: ${space(1)};

  &:not(:last-child) {
    border-bottom: solid 1px ${p => p.theme.innerBorder};
  }
`;
