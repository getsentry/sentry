import {Fragment} from 'react';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/button';
import {SectionHeading} from 'sentry/components/charts/styles';
import DateTime from 'sentry/components/dateTime';
import Duration from 'sentry/components/duration';
import ProjectBadge from 'sentry/components/idBadge/projectBadge';
import LoadingError from 'sentry/components/loadingError';
import Pagination from 'sentry/components/pagination';
import PanelTable from 'sentry/components/panels/panelTable';
import Placeholder from 'sentry/components/placeholder';
import ShortId from 'sentry/components/shortId';
import StatusIndicator from 'sentry/components/statusIndicator';
import Text from 'sentry/components/text';
import {Tooltip} from 'sentry/components/tooltip';
import {IconDownload} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import ConfigStore from 'sentry/stores/configStore';
import {space} from 'sentry/styles/space';
import {defined} from 'sentry/utils';
import {useApiQuery} from 'sentry/utils/queryClient';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import {QuickContextHovercard} from 'sentry/views/discover/table/quickContext/quickContextHovercard';
import {ContextType} from 'sentry/views/discover/table/quickContext/utils';
import {
  CheckIn,
  CheckInStatus,
  Monitor,
  MonitorEnvironment,
} from 'sentry/views/monitors/types';
import {statusToText} from 'sentry/views/monitors/utils';

type Props = {
  monitor: Monitor;
  monitorEnvs: MonitorEnvironment[];
  orgSlug: string;
};

const checkStatusToIndicatorStatus: Record<
  CheckInStatus,
  'success' | 'error' | 'muted' | 'warning'
> = {
  [CheckInStatus.OK]: 'success',
  [CheckInStatus.ERROR]: 'error',
  [CheckInStatus.IN_PROGRESS]: 'muted',
  [CheckInStatus.MISSED]: 'warning',
  [CheckInStatus.TIMEOUT]: 'error',
};

function MonitorCheckIns({monitor, monitorEnvs, orgSlug}: Props) {
  const location = useLocation();
  const organization = useOrganization();
  const queryKey = [
    `/organizations/${orgSlug}/monitors/${monitor.slug}/checkins/`,
    {
      query: {
        per_page: '10',
        environment: monitorEnvs.map(e => e.name),
        expand: 'groups',
        ...location.query,
      },
    },
  ] as const;

  const {
    data: checkInList,
    getResponseHeader,
    isLoading,
    isError,
  } = useApiQuery<CheckIn[]>(queryKey, {staleTime: 0});

  if (isError) {
    return <LoadingError />;
  }

  const generateDownloadUrl = (checkin: CheckIn) =>
    `/api/0/organizations/${orgSlug}/monitors/${monitor.slug}/checkins/${checkin.id}/attachment/`;

  const emptyCell = <Text>{'\u2014'}</Text>;

  // XXX(epurkhiser): Attachmnets are still experimental and may not exist in
  // the future. For now hide these if they're not being used.
  const hasAttachments = checkInList?.some(checkin => checkin.attachmentId !== null);
  const hasMultiEnv = monitorEnvs.length > 1;

  const headers = [
    t('Status'),
    t('Started'),
    t('Duration'),
    t('Issues'),
    ...(hasAttachments ? [t('Attachment')] : []),
    ...(hasMultiEnv ? [t('Environment')] : []),
    t('Expected At'),
  ];

  const customTimezone =
    monitor.config.timezone &&
    monitor.config.timezone !== ConfigStore.get('user').options.timezone;

  return (
    <Fragment>
      <SectionHeading>{t('Recent Check-Ins')}</SectionHeading>
      <PanelTable headers={headers}>
        {isLoading
          ? [...new Array(headers.length)].map((_, i) => (
              <RowPlaceholder key={i}>
                <Placeholder height="2rem" />
              </RowPlaceholder>
            ))
          : checkInList.map(checkIn => (
              <Fragment key={checkIn.id}>
                <Status>
                  <StatusIndicator
                    status={checkStatusToIndicatorStatus[checkIn.status]}
                    tooltipTitle={tct('Check In Status: [status]', {
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
                      {<DateTime date={checkIn.dateCreated} timeZone seconds />}
                    </Tooltip>
                  </div>
                ) : (
                  emptyCell
                )}
                {defined(checkIn.duration) ? (
                  <Duration seconds={checkIn.duration / 1000} />
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
                        {
                          <StyledShortId
                            shortId={shortId}
                            avatar={
                              <ProjectBadge
                                project={monitor.project}
                                hideName
                                avatarSize={12}
                              />
                            }
                            to={`/issues/${id}`}
                          />
                        }
                      </QuickContextHovercard>
                    ))}
                  </IssuesContainer>
                ) : (
                  emptyCell
                )}
                {!hasAttachments ? null : checkIn.attachmentId ? (
                  <div>
                    <Button
                      size="xs"
                      icon={<IconDownload />}
                      href={generateDownloadUrl(checkIn)}
                    >
                      {t('Attachment')}
                    </Button>
                  </div>
                ) : (
                  emptyCell
                )}
                {!hasMultiEnv ? null : <div>{checkIn.environment}</div>}
                <div>
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
                </div>
              </Fragment>
            ))}
      </PanelTable>
      <Pagination pageLinks={getResponseHeader?.('Link')} />
    </Fragment>
  );
}

export default MonitorCheckIns;

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
