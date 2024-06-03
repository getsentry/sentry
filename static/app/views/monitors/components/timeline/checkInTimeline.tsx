import styled from '@emotion/styled';

import {DateTime} from 'sentry/components/dateTime';
import {Tooltip} from 'sentry/components/tooltip';
import {CheckInStatus} from 'sentry/views/monitors/types';
import {getTickStyle} from 'sentry/views/monitors/utils';

import {getAggregateStatus} from './utils/getAggregateStatus';
import {mergeBuckets} from './utils/mergeBuckets';
import {CheckInTooltip} from './checkInTooltip';
import type {MonitorBucketData, TimeWindowConfig} from './types';

interface TimelineProps {
  timeWindowConfig: TimeWindowConfig;
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
  const {bucketedData, timeWindowConfig, environment} = props;
  const {start, end, timelineWidth} = timeWindowConfig;

  const elapsedMs = end.getTime() - start.getTime();
  const msPerPixel = elapsedMs / timelineWidth;

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
          <CheckInTooltip
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
              data-test-id="monitor-checkin-tick"
            />
          </CheckInTooltip>
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
  timeWindowConfig,
}: MockCheckInTimelineProps) {
  const {start, end} = timeWindowConfig;
  const elapsedMs = end.getTime() - start.getTime();
  const msPerPixel = elapsedMs / timeWindowConfig.timelineWidth;

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
              data-test-id="monitor-checkin-tick"
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
  width: 4px;
  height: 14px;
  transform: translateY(-50%);
  opacity: 0.7;

  ${p => getTickStyle(p.status, p.theme)};

  ${p =>
    p.roundedLeft &&
    `
    border-top-left-radius: 2px;
    border-bottom-left-radius: 2px;
  `};
  ${p =>
    p.roundedRight &&
    `
    border-top-right-radius: 2px;
    border-bottom-right-radius: 2px;
  `}
  ${p => !p.roundedLeft && 'border-left-width: 0'};
  ${p => !p.roundedRight && 'border-right-width: 0'};
`;
