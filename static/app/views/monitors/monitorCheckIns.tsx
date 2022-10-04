import styled from '@emotion/styled';

import Duration from 'sentry/components/duration';
import {PanelBody, PanelItem} from 'sentry/components/panels';
import TimeSince from 'sentry/components/timeSince';
import space from 'sentry/styles/space';
import useApiRequests from 'sentry/utils/useApiRequests';
import {Monitor} from 'sentry/views/monitors/types';

import CheckInIcon from './checkInIcon';

type CheckIn = {
  dateCreated: string;
  duration: number;
  id: string;
  status: 'ok' | 'error';
};

type Props = {
  monitor: Monitor;
};

type State = {
  checkInList: CheckIn[];
};

const MonitorCheckIns = ({monitor}: Props) => {
  const {data, hasError, renderComponent} = useApiRequests<State>({
    endpoints: [
      ['checkInList', `/monitors/${monitor.id}/checkins/`, {query: {per_page: '10'}}],
    ],
  });

  const renderedComponent = renderComponent(
    <PanelBody>
      {data.checkInList?.map(checkIn => (
        <PanelItem key={checkIn.id}>
          <CheckInIconWrapper>
            <CheckInIcon status={checkIn.status} size={16} />
          </CheckInIconWrapper>
          <TimeSinceWrapper>
            <TimeSince date={checkIn.dateCreated} />
          </TimeSinceWrapper>
          <DurationWrapper>
            {checkIn.duration && <Duration seconds={checkIn.duration / 100} />}
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
