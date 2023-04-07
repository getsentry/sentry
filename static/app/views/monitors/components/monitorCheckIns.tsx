import React from 'react';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/button';
import Duration from 'sentry/components/duration';
import Pagination from 'sentry/components/pagination';
import {Panel, PanelBody, PanelHeader, PanelItem} from 'sentry/components/panels';
import TimeSince from 'sentry/components/timeSince';
import {Tooltip} from 'sentry/components/tooltip';
import {IconDownload} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {defined} from 'sentry/utils';
import useApiRequests from 'sentry/utils/useApiRequests';
import {CheckInStatus, Monitor, MonitorEnvironment} from 'sentry/views/monitors/types';

import CheckInIcon from './checkInIcon';

type CheckIn = {
  dateCreated: string;
  duration: number;
  id: string;
  status: CheckInStatus;
  attachmentId?: number;
};

type Props = {
  monitor: Monitor;
  monitorEnv: MonitorEnvironment;
  orgId: string;
};

type State = {
  checkInList: CheckIn[];
};

const MonitorCheckIns = ({monitor, monitorEnv, orgId}: Props) => {
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

  const renderedComponent = renderComponent(
    <React.Fragment>
      <Panel>
        <PanelHeader>{t('Recent Check-ins')}</PanelHeader>
        <PanelBody>
          {data.checkInList?.map(checkIn => (
            <PanelItem key={checkIn.id}>
              <CheckInIconWrapper>
                <Tooltip
                  title={tct('Check In Status: [status]', {
                    status: checkIn.status,
                  })}
                >
                  <CheckInIcon status={checkIn.status} size={16} />
                </Tooltip>
              </CheckInIconWrapper>
              <TimeSinceWrapper>
                <TimeSince date={checkIn.dateCreated} />
              </TimeSinceWrapper>
              <DurationWrapper>
                {defined(checkIn.duration) && (
                  <Duration seconds={checkIn.duration / 1000} />
                )}
              </DurationWrapper>
              <AttachmentWrapper>
                {checkIn.attachmentId && (
                  <Button
                    size="xs"
                    icon={<IconDownload size="xs" />}
                    href={generateDownloadUrl(checkIn)}
                  >
                    Attachment
                  </Button>
                )}
              </AttachmentWrapper>
            </PanelItem>
          ))}
        </PanelBody>
      </Panel>
      <Pagination pageLinks={data.checkInListPageLinks} />
    </React.Fragment>
  );

  return hasError ? <ErrorWrapper>{renderedComponent}</ErrorWrapper> : renderedComponent;
};

export default MonitorCheckIns;

const DivMargin = styled('div')`
  margin-right: ${space(2)};
`;

const CheckInIconWrapper = styled(DivMargin)`
  display: flex;
  align-items: center;
`;

const TimeSinceWrapper = styled(DivMargin)`
  font-variant-numeric: tabular-nums;
`;

const DurationWrapper = styled('div')`
  font-variant-numeric: tabular-nums;
`;

const ErrorWrapper = styled('div')`
  margin: ${space(3)} ${space(3)} 0;
`;

const AttachmentWrapper = styled('div')`
  margin-left: auto;
`;
