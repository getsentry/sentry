import {Theme} from '@emotion/react';
import styled from '@emotion/styled';

import DateTime from 'sentry/components/dateTime';
import {Resizeable} from 'sentry/components/replays/resizeable';
import {Tooltip} from 'sentry/components/tooltip';
import {space} from 'sentry/styles/space';
import {MonitorBucketData} from 'sentry/views/monitors/components/overviewTimeline/types';
import {CheckInStatus} from 'sentry/views/monitors/types';
import {getAggregateStatus} from 'sentry/views/monitors/utils/getAggregateStatus';
import {mergeBuckets} from 'sentry/views/monitors/utils/mergeBuckets';

interface Props {
  bucketedData: MonitorBucketData;
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

    const jobTicks = mergeBuckets(bucketedData);

    return (
      <TimelineContainer>
        {jobTicks.map(
          ({startTs, width: tickWidth, envMapping, roundedLeft, roundedRight}) => {
            const timestampMs = startTs * 1000;
            const left = getBucketedCheckInsPosition(timestampMs, start, msPerPixel);

            return (
              <JobTickContainer style={{left}} key={startTs}>
                <Tooltip title={<DateTime date={timestampMs} seconds />}>
                  <JobTick
                    style={{width: tickWidth}}
                    status={getAggregateStatus(envMapping)}
                    roundedLeft={roundedLeft}
                    roundedRight={roundedRight}
                  />
                </Tooltip>
              </JobTickContainer>
            );
          }
        )}
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
`;

const JobTick = styled('div')<{
  roundedLeft: boolean;
  roundedRight: boolean;
  status: CheckInStatus;
}>`
  background: ${p => getColorFromStatus(p.status, p.theme)};
  width: 4px;
  height: 14px;
  ${p =>
    p.roundedLeft &&
    `
    border-top-left-radius: 2px;
    border-bottom-left-radius: 2px;
  `}
  ${p =>
    p.roundedRight &&
    `
    border-top-right-radius: 2px;
    border-bottom-right-radius: 2px;
  `}
`;
