import {Theme} from '@emotion/react';
import styled from '@emotion/styled';

import DateTime from 'sentry/components/dateTime';
import {Resizeable} from 'sentry/components/replays/resizeable';
import {Tooltip} from 'sentry/components/tooltip';
import {space} from 'sentry/styles/space';
import {
  MonitorBucketData,
  MonitorBucketEnvMapping,
} from 'sentry/views/monitors/components/overviewTimeline/types';
import {CheckInStatus} from 'sentry/views/monitors/types';

interface Props {
  bucketedData: MonitorBucketData;
  end: Date;
  start: Date;
  width?: number;
}

function getAggregateStatus(envData: MonitorBucketEnvMapping) {
  // Orders the status in terms of precedence for showing to the user
  const statusOrdering = [
    CheckInStatus.OK,
    CheckInStatus.MISSED,
    CheckInStatus.TIMEOUT,
    CheckInStatus.ERROR,
  ];

  return Object.values(envData).reduce((currentStatus, value) => {
    for (const [index, status] of statusOrdering.entries()) {
      if (value[status] > 0 && index > statusOrdering.indexOf(currentStatus)) {
        currentStatus = status;
      }
    }
    return currentStatus;
  }, CheckInStatus.OK);
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

function getBucketedCheckInsPosition(
  timestamp: number,
  timelineStart: Date,
  msPerPixel: number
) {
  const elapsedSinceStart = new Date(timestamp).getTime() - timelineStart.getTime();
  return elapsedSinceStart / msPerPixel;
}

export function CheckInTimeline(props: Props) {
  const {bucketedData, start, end} = props;

  function renderTimelineWithWidth(width: number) {
    const timeWindow = end.getTime() - start.getTime();
    const msPerPixel = timeWindow / width;

    return (
      <TimelineContainer>
        {bucketedData.map(([timestamp, envData]) => {
          const timestampMs = timestamp * 1000;
          if (Object.keys(envData).length === 0) {
            return null;
          }

          const left = getBucketedCheckInsPosition(timestampMs, start, msPerPixel);
          if (left < 0) {
            return null;
          }

          return (
            <JobTickContainer style={{left}} key={timestamp}>
              <Tooltip title={<DateTime date={timestampMs} seconds />}>
                <JobTick status={getAggregateStatus(envData)} />
              </Tooltip>
            </JobTickContainer>
          );
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
  margin: ${space(2)} 0;
`;

const JobTickContainer = styled('div')`
  position: absolute;
  transform: translateX(-50%);
`;

const JobTick = styled('div')<{status: CheckInStatus}>`
  background: ${p => getColorFromStatus(p.status, p.theme)};
  width: 4px;
  height: 14px;
  border-radius: 6px;
`;
