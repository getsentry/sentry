import React from 'react';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/button';
import {SectionHeading} from 'sentry/components/charts/styles';
import DateTime from 'sentry/components/dateTime';
import Duration from 'sentry/components/duration';
import Pagination from 'sentry/components/pagination';
import {PanelTable} from 'sentry/components/panels';
import StatusIndicator from 'sentry/components/statusIndicator';
import Text from 'sentry/components/text';
import {IconDownload} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {defined} from 'sentry/utils';
import useApiRequests from 'sentry/utils/useApiRequests';
import {
  CheckIn,
  CheckInStatus,
  Monitor,
  MonitorEnvironment,
} from 'sentry/views/monitors/types';

type Props = {
  monitor: Monitor;
  monitorEnv: MonitorEnvironment;
  orgId: string;
};

type State = {
  checkInList: CheckIn[];
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

const statusToText: Record<CheckInStatus, string> = {
  [CheckInStatus.OK]: t('Okay'),
  [CheckInStatus.ERROR]: t('Failed'),
  [CheckInStatus.IN_PROGRESS]: t('In Progress'),
  [CheckInStatus.MISSED]: t('Missed'),
  [CheckInStatus.TIMEOUT]: t('Timed Out'),
};

function MonitorCheckIns({monitor, monitorEnv, orgId}: Props) {
  const {data, hasError, renderComponent} = useApiRequests<State>({
    endpoints: [
      [
        'checkInList',
        `/organizations/${orgId}/monitors/${monitor.slug}/checkins/`,
        {query: {per_page: '10', environment: monitorEnv.name}},
        {paginate: true},
      ],
    ],
  });

  const generateDownloadUrl = (checkin: CheckIn) =>
    `/api/0/organizations/${orgId}/monitors/${monitor.slug}/checkins/${checkin.id}/attachment/`;

  const emptyCell = <Text>{'\u2014'}</Text>;

  const renderedComponent = renderComponent(
    <React.Fragment>
      <SectionHeading>{t('Recent Check-Ins')}</SectionHeading>
      <PanelTable
        headers={[
          t('Status'),
          t('Started'),
          t('Duration'),
          t('Attachment'),
          t('Timestamp'),
        ]}
      >
        {data.checkInList?.map(checkIn => (
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
              <DateTime date={checkIn.dateCreated} timeOnly />
            ) : (
              emptyCell
            )}
            {defined(checkIn.duration) ? (
              <Duration seconds={checkIn.duration / 1000} />
            ) : (
              emptyCell
            )}
            {checkIn.attachmentId ? (
              <Button
                size="xs"
                icon={<IconDownload size="xs" />}
                href={generateDownloadUrl(checkIn)}
              >
                Attachment
              </Button>
            ) : (
              emptyCell
            )}
            <Timestamp date={checkIn.dateCreated} />
          </React.Fragment>
        ))}
      </PanelTable>
      <Pagination pageLinks={data.checkInListPageLinks} />
    </React.Fragment>
  );

  return hasError ? <ErrorWrapper>{renderedComponent}</ErrorWrapper> : renderedComponent;
}

export default MonitorCheckIns;

const Status = styled('div')`
  display: flex;
  align-items: center;
`;

const Timestamp = styled(DateTime)`
  color: ${p => p.theme.subText};
`;

const ErrorWrapper = styled('div')`
  margin: ${space(3)} ${space(3)} 0;
`;
