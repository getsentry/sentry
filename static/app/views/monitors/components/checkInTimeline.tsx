import {Theme} from '@emotion/react';
import styled from '@emotion/styled';

import {Resizeable} from 'sentry/components/replays/resizeable';
import {space} from 'sentry/styles/space';
import {CheckIn, CheckInStatus} from 'sentry/views/monitors/types';

interface Props {
  checkins: CheckIn[];
  end: Date;
  start: Date;
  width?: number;
}

function getColorFromStatus(status: CheckInStatus, theme: Theme) {
  const statusToColor: Record<CheckInStatus, string> = {
    [CheckInStatus.ERROR]: theme.red200,
    [CheckInStatus.TIMEOUT]: theme.red200,
    [CheckInStatus.OK]: theme.green200,
    [CheckInStatus.MISSED]: theme.yellow200,
    [CheckInStatus.IN_PROGRESS]: theme.disabled,
  };
  return statusToColor[status];
}

function getCheckInPosition(checkDate: string, timelineStart: Date, msPerPixel: number) {
  const elapsedSinceStart = new Date(checkDate).getTime() - timelineStart.getTime();
  return elapsedSinceStart / msPerPixel;
}

export function CheckInTimeline(props: Props) {
  const {checkins, start, end} = props;

  function renderTimelineWithWidth(width: number) {
    const timeWindow = end.getTime() - start.getTime();
    const msPerPixel = timeWindow / width;

    return (
      <TimelineContainer>
        {checkins.map(({id, dateCreated, status}) => {
          const left = getCheckInPosition(dateCreated, start, msPerPixel);
          if (left < 0) {
            return null;
          }

          return <JobTick key={id} left={left} status={status} />;
        })}
      </TimelineContainer>
    );
  }

  if (props.width) {
    return renderTimelineWithWidth(props.width);
  }

  return <Resizeable>{({width}) => renderTimelineWithWidth(width)}</Resizeable>;
}

const TimelineContainer = styled('div')`
  position: relative;
  height: 14px;
  margin: ${space(4)} 0;
`;

const JobTick = styled('div')<{left: number; status: CheckInStatus}>`
  position: absolute;
  width: 4px;
  height: 14px;
  border-radius: 6px;
  left: ${p => p.left}px;

  background: ${p => getColorFromStatus(p.status, p.theme)};
`;
