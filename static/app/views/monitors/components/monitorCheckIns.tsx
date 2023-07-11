import React from 'react';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/button';
import {SectionHeading} from 'sentry/components/charts/styles';
import DateTime from 'sentry/components/dateTime';
import Duration from 'sentry/components/duration';
import Link from 'sentry/components/links/link';
import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import Pagination from 'sentry/components/pagination';
import PanelTable from 'sentry/components/panels/panelTable';
import StatusIndicator from 'sentry/components/statusIndicator';
import Text from 'sentry/components/text';
import {Tooltip} from 'sentry/components/tooltip';
import {IconDownload} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
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
  orgId: string;
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

function MonitorCheckIns({monitor, monitorEnvs, orgId}: Props) {
  const location = useLocation();
  const organization = useOrganization();
  const queryKey = [
    `/organizations/${orgId}/monitors/${monitor.slug}/checkins/`,
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

  if (isLoading) {
    return <LoadingIndicator />;
  }
  if (isError) {
    return <LoadingError />;
  }

  const generateDownloadUrl = (checkin: CheckIn) =>
    `/api/0/organizations/${orgId}/monitors/${monitor.slug}/checkins/${checkin.id}/attachment/`;

  const emptyCell = <Text>{'\u2014'}</Text>;

  return (
    <React.Fragment>
      <SectionHeading>{t('Recent Check-Ins')}</SectionHeading>
      <PanelTable
        headers={[
          t('Status'),
          t('Started'),
          t('Duration'),
          t('Issues'),
          t('Attachment'),
          t('Timestamp'),
        ]}
      >
        {checkInList.map(checkIn => (
          <React.Fragment key={checkIn.id}>
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
                {monitor.config.timezone ? (
                  <Tooltip
                    title={
                      <DateTime
                        date={checkIn.dateCreated}
                        forcedTimezone={monitor.config.timezone}
                        timeZone
                        timeOnly
                      />
                    }
                  >
                    {<DateTime date={checkIn.dateCreated} timeOnly />}
                  </Tooltip>
                ) : (
                  <DateTime date={checkIn.dateCreated} timeOnly />
                )}
              </div>
            ) : (
              emptyCell
            )}
            {defined(checkIn.duration) ? (
              <Duration seconds={checkIn.duration / 1000} />
            ) : (
              emptyCell
            )}
            {checkIn.groups && checkIn.groups?.length > 0 ? (
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
                    {<Link to={`/issues/${id}`}>{shortId}</Link>}
                  </QuickContextHovercard>
                ))}
              </IssuesContainer>
            ) : (
              emptyCell
            )}
            {checkIn.attachmentId ? (
              <Button
                size="xs"
                icon={<IconDownload size="xs" />}
                href={generateDownloadUrl(checkIn)}
              >
                {t('Attachment')}
              </Button>
            ) : (
              emptyCell
            )}
            <Timestamp date={checkIn.dateCreated} />
          </React.Fragment>
        ))}
      </PanelTable>
      <Pagination pageLinks={getResponseHeader?.('Link')} />
    </React.Fragment>
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
