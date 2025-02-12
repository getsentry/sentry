import {css} from '@emotion/react';
import styled from '@emotion/styled';

import {DateTime} from 'sentry/components/dateTime';
import {Tooltip} from 'sentry/components/tooltip';

import {getAggregateStatus} from './utils/getAggregateStatus';
import {getTickStyle} from './utils/getTickStyle';
import {mergeBuckets} from './utils/mergeBuckets';
import {CheckInTooltip} from './checkInTooltip';
import type {CheckInBucket, TickStyle, TimeWindowConfig} from './types';

interface CheckInTimelineConfig<Status extends string> {
  /**
   * Maps the job tick status to a human readable label
   */
  statusLabel: Record<Status, string>;
  /**
   * Configures the priority of check-in statuses. Higher priority statuses
   * will will show in bucketed ticks.
   */
  statusPrecedent: Status[];
  /**
   * Configures the styling of the tooltip labels
   */
  statusStyle: Record<Status, TickStyle>;
  timeWindowConfig: TimeWindowConfig;
  className?: string;
}

export interface CheckInTimelineProps<Status extends string>
  extends CheckInTimelineConfig<Status> {
  /**
   * Represents each check-in tick as bucketed check-in data.
   */
  bucketedData: Array<CheckInBucket<Status>>;
}

function getBucketedCheckInsPosition(
  timestamp: number,
  timelineStart: Date,
  msPerPixel: number
) {
  const elapsedSinceStart = new Date(timestamp).getTime() - timelineStart.getTime();
  return elapsedSinceStart / msPerPixel;
}

export function CheckInTimeline<Status extends string>({
  bucketedData,
  timeWindowConfig,
  statusLabel,
  statusStyle,
  statusPrecedent,
  className,
}: CheckInTimelineProps<Status>) {
  const jobTicks = mergeBuckets(
    statusPrecedent,
    timeWindowConfig.rollupConfig,
    bucketedData
  );

  return (
    <TimelineContainer role="figure" className={className}>
      {jobTicks.map(jobTick => {
        const {left, startTs, width, stats, isStarting, isEnding} = jobTick;

        const status = getAggregateStatus(statusPrecedent, stats)!;

        return (
          <CheckInTooltip
            jobTick={jobTick}
            statusStyle={statusStyle}
            statusLabel={statusLabel}
            timeWindowConfig={timeWindowConfig}
            skipWrapper
            key={startTs}
          >
            <JobTick
              style={{left, width}}
              css={theme => getTickStyle(statusStyle, status, theme)}
              roundedLeft={isStarting}
              roundedRight={isEnding}
              data-test-id="monitor-checkin-tick"
            />
          </CheckInTooltip>
        );
      })}
    </TimelineContainer>
  );
}

export interface MockCheckInTimelineProps<Status extends string>
  extends CheckInTimelineConfig<Status> {
  mockTimestamps: Date[];
  /**
   * The status to use for each mocked tick
   */
  status: Status;
}

export function MockCheckInTimeline<Status extends string>({
  mockTimestamps,
  timeWindowConfig,
  status,
  statusStyle,
}: MockCheckInTimelineProps<Status>) {
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
              css={theme => getTickStyle(statusStyle, status, theme)}
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
  height: 14px;
`;

const JobTick = styled('div')<{
  roundedLeft: boolean;
  roundedRight: boolean;
}>`
  position: absolute;
  top: calc(50% + 1px);
  width: 4px;
  height: 14px;
  transform: translateY(-50%);
  opacity: 0.7;

  ${p =>
    p.roundedLeft &&
    css`
      border-top-left-radius: 2px;
      border-bottom-left-radius: 2px;
    `};
  ${p =>
    p.roundedRight &&
    css`
      border-top-right-radius: 2px;
      border-bottom-right-radius: 2px;
    `}
  ${p =>
    !p.roundedLeft &&
    css`
      border-left-width: 0;
    `};
  ${p =>
    !p.roundedRight &&
    css`
      border-right-width: 0;
    `};
`;
