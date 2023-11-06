import styled from '@emotion/styled';

import DateTime from 'sentry/components/dateTime';
import {Tooltip} from 'sentry/components/tooltip';
import {CheckInStatus} from 'sentry/views/monitors/types';
import {getColorsFromStatus} from 'sentry/views/monitors/utils';
import {getAggregateStatus} from 'sentry/views/monitors/utils/getAggregateStatus';
import {mergeBuckets} from 'sentry/views/monitors/utils/mergeBuckets';

import {JobTickTooltip} from './jobTickTooltip';
import {MonitorBucketData, TimeWindowOptions} from './types';

interface TimelineProps {
  end: Date;
  start: Date;
  timeWindowConfig: TimeWindowOptions;
  width: number;
}

export interface CheckInTimelineProps extends TimelineProps {
  bucketedData: MonitorBucketData;
  environment: string;
}

function getBucketedCheckInsPosition(
  timestamp: number,
  timelineStart: Date,
  msPerPixel: number
) {
  const elapsedSinceStart = new Date(timestamp).getTime() - timelineStart.getTime();
  return elapsedSinceStart / msPerPixel;
}

export function CheckInTimeline(props: CheckInTimelineProps) {
  const {bucketedData, start, end, timeWindowConfig, width, environment} = props;

  const elapsedMs = end.getTime() - start.getTime();
  const msPerPixel = elapsedMs / width;

  const jobTicks = mergeBuckets(bucketedData, environment);

  return (
    <TimelineContainer>
      {jobTicks.map(jobTick => {
        const {
          startTs,
          width: tickWidth,
          envMapping,
          roundedLeft,
          roundedRight,
        } = jobTick;
        const timestampMs = startTs * 1000;
        const left = getBucketedCheckInsPosition(timestampMs, start, msPerPixel);

        return (
          <JobTickTooltip
            jobTick={jobTick}
            timeWindowConfig={timeWindowConfig}
            skipWrapper
            key={startTs}
          >
            <JobTick
              style={{left, width: tickWidth}}
              status={getAggregateStatus(envMapping)}
              roundedLeft={roundedLeft}
              roundedRight={roundedRight}
            />
          </JobTickTooltip>
        );
      })}
    </TimelineContainer>
  );
}

export interface MockCheckInTimelineProps extends TimelineProps {
  mockTimestamps: Date[];
}

export function MockCheckInTimeline({
  mockTimestamps,
  start,
  end,
  timeWindowConfig,
  width,
}: MockCheckInTimelineProps) {
  const elapsedMs = end.getTime() - start.getTime();
  const msPerPixel = elapsedMs / width;

  return (
    <TimelineContainer>
      {mockTimestamps.map(ts => {
        const timestampMs = ts.getTime();
        const left = getBucketedCheckInsPosition(timestampMs, start, msPerPixel);

        return (
          <Tooltip
            key={left}
            title={
              <DateTime date={timestampMs} format={timeWindowConfig.dateLabelFormat} />
            }
            skipWrapper
          >
            <JobTick
              style={{left}}
              status={CheckInStatus.IN_PROGRESS}
              roundedLeft
              roundedRight
            />
          </Tooltip>
        );
      })}
    </TimelineContainer>
  );
}

const TimelineContainer = styled('div')`
  position: relative;
  height: 100%;
`;

const JobTick = styled('div')<{
  roundedLeft: boolean;
  roundedRight: boolean;
  status: CheckInStatus;
}>`
  position: absolute;
  top: calc(50% + 1px);
  transform: translateY(-50%);
  background: ${p => getColorsFromStatus(p.status, p.theme).tickColor};
  opacity: 0.7;
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
