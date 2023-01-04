import styled from '@emotion/styled';

import Duration from 'sentry/components/duration';
import {PanelBody, PanelItem} from 'sentry/components/panels';
import TimeSince from 'sentry/components/timeSince';
import Tooltip from 'sentry/components/tooltip';
import {tct} from 'sentry/locale';
import space from 'sentry/styles/space';
import {defined} from 'sentry/utils';
import useApiRequests from 'sentry/utils/useApiRequests';
import {CheckInStatus, Monitor} from 'sentry/views/monitors/types';

import CheckInIcon from './checkInIcon';

type CheckIn = {
  dateCreated: string;
  duration: number;
  id: string;
  status: CheckInStatus;
};

type Props = {
  monitor: Monitor;
  orgId: string;
};

type State = {
  checkInList: CheckIn[];
};

const MonitorCheckIns = ({monitor, orgId}: Props) => {
  const {data, hasError, renderComponent} = useApiRequests<State>({
    endpoints: [
      [
        'checkInList',
        `/monitors/${orgId}/${monitor.id}/checkins/`,
        {query: {per_page: '10'}},
      ],
    ],
  });

  const renderedComponent = renderComponent(
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
            {defined(checkIn.duration) && <Duration seconds={checkIn.duration / 1000} />}
          </DurationWrapper>
        </PanelItem>
      ))}
    </PanelBody>
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
