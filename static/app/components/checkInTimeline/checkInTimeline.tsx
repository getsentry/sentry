import {css} from '@emotion/react';
import styled from '@emotion/styled';
import chunk from 'lodash/chunk';

import {Container} from '@sentry/scraps/layout';
import {Tooltip, type TooltipProps} from '@sentry/scraps/tooltip';

import {DateTime} from 'sentry/components/dateTime';
import {tn} from 'sentry/locale';

import {getAggregateStatus} from './utils/getAggregateStatus';
import {getTickStyle} from './utils/getTickStyle';
import {isStatsBucketEmpty} from './utils/isStatsBucketEmpty';
import {mergeBuckets} from './utils/mergeBuckets';
import {mergeStats} from './utils/mergeStats';
import {CheckInTooltip} from './checkInTooltip';
import type {CheckInBucket, JobTickData, TickStyle, TimeWindowConfig} from './types';

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
  statusStyle: TickStyle<Status>;
  timeWindowConfig: TimeWindowConfig;
  className?: string;
  displayMode?: 'aggregate' | 'stacked';
  stackedStatusOrder?: Status[];
  style?: React.CSSProperties;
}

interface CheckInTimelineProps<
  Status extends string,
> extends CheckInTimelineConfig<Status> {
  /**
   * Represents each check-in tick as bucketed check-in data.
   */
  bucketedData: Array<CheckInBucket<Status>>;
  /**
   * Status unit. Displayed on the check-in tooltip.
   *
   * Defaults to 'check-ins'
   */
  makeUnit?: (count: number) => React.ReactNode;

  /**
   * Extra props to pass to the Tooltip component,
   * Title is determined by the CheckInTooltip component
   */
  tooltipProps?: Omit<TooltipProps, 'title' | 'skipWrapper'>;
}

export function CheckInTimeline<Status extends string>({
  bucketedData,
  timeWindowConfig,
  statusLabel,
  statusStyle,
  statusPrecedent,
  className,
  style,
  displayMode = 'aggregate',
  stackedStatusOrder = statusPrecedent,
  makeUnit = count => tn('check-in', 'check-ins', count),
  tooltipProps,
}: CheckInTimelineProps<Status>) {
  const jobTicks =
    displayMode === 'stacked'
      ? getStackedJobTicks(statusPrecedent, timeWindowConfig.rollupConfig, bucketedData)
      : mergeBuckets(statusPrecedent, timeWindowConfig.rollupConfig, bucketedData);
  const isStacked = displayMode === 'stacked';

  return (
    <Container
      width="100%"
      height="14px"
      overflow="hidden"
      position="relative"
      role="figure"
      className={className}
      style={style}
    >
      {jobTicks.map(jobTick => {
        const {left, startTs, width, stats, isStarting, isEnding} = jobTick;

        const status = getAggregateStatus(statusPrecedent, stats)!;
        const total = getStatsTotal(stats);

        return (
          <CheckInTooltip
            jobTick={jobTick}
            statusStyle={statusStyle}
            statusLabel={statusLabel}
            timeWindowConfig={timeWindowConfig}
            skipWrapper
            key={startTs}
            makeUnit={makeUnit}
            {...tooltipProps}
          >
            {isStacked ? (
              <StackedJobTick style={{left, width}} data-test-id="monitor-checkin-tick">
                {stackedStatusOrder.map(stackedStatus => {
                  const count = stats[stackedStatus] ?? 0;

                  if (count <= 0) {
                    return null;
                  }

                  return (
                    <StackedJobTickSegment
                      key={stackedStatus}
                      style={{height: `${(count / total) * 100}%`}}
                      css={theme => ({
                        background: statusStyle(theme)[stackedStatus]?.tickColor,
                      })}
                      data-test-id="monitor-checkin-tick-segment"
                    />
                  );
                })}
              </StackedJobTick>
            ) : (
              <JobTick
                style={{left, width}}
                css={theme => getTickStyle(statusStyle, status, theme)}
                roundedLeft={isStarting && left !== 0}
                roundedRight={isEnding && left + width !== timeWindowConfig.timelineWidth}
                data-test-id="monitor-checkin-tick"
              />
            )}
          </CheckInTooltip>
        );
      })}
    </Container>
  );
}

function getStatsTotal<Status extends string>(stats: JobTickData<Status>['stats']) {
  return Object.values<number>(stats).reduce((sum, count) => sum + count, 0);
}

function getStackedJobTicks<Status extends string>(
  statusPrecedent: Status[],
  rollupConfig: TimeWindowConfig['rollupConfig'],
  data: Array<CheckInBucket<Status>>
): Array<JobTickData<Status>> {
  const {bucketPixels, interval} = rollupConfig;
  const groupedBuckets =
    bucketPixels < 1 ? chunk(data, 1 / bucketPixels) : data.map(bucket => [bucket]);
  const width = Math.max(1, bucketPixels);

  return groupedBuckets.flatMap((currentGroup, index) => {
    const stats = mergeStats(statusPrecedent, ...currentGroup.map(bucket => bucket[1]));

    if (isStatsBucketEmpty(stats)) {
      return [];
    }

    const startTs = currentGroup.at(0)![0];
    const endTs = currentGroup.at(-1)![0] + interval;
    const left = index * width - rollupConfig.underscanStartOffset;

    return [
      {
        endTs,
        isEnding: false,
        isStarting: false,
        left,
        startTs,
        stats,
        width,
      },
    ];
  });
}

interface MockCheckInTimelineProps<
  Status extends string,
> extends CheckInTimelineConfig<Status> {
  mockTimestamps: Date[];
  /**
   * The status to use for each mocked tick
   */
  status: Status;
}

function getBucketedCheckInsPosition(
  timestamp: number,
  timelineStart: Date,
  msPerPixel: number
) {
  const elapsedSinceStart = new Date(timestamp).getTime() - timelineStart.getTime();
  return elapsedSinceStart / msPerPixel;
}

export function MockCheckInTimeline<Status extends string>({
  mockTimestamps,
  timeWindowConfig,
  status,
  statusStyle,
}: MockCheckInTimelineProps<Status>) {
  const {periodStart, elapsedMinutes, timelineWidth, rollupConfig} = timeWindowConfig;
  const msPerPixel = (elapsedMinutes * 60 * 1000) / timelineWidth;
  const startOffset = rollupConfig.timelineUnderscanWidth;

  return (
    <Container width="100%" height="14px" overflow="hidden" position="relative">
      {mockTimestamps.map(ts => {
        const timestampMs = ts.getTime();
        const left =
          startOffset + getBucketedCheckInsPosition(timestampMs, periodStart, msPerPixel);

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
    </Container>
  );
}

const JobTick = styled('div')<{
  roundedLeft: boolean;
  roundedRight: boolean;
}>`
  position: absolute;
  width: 4px;
  height: 14px;

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

const StackedJobTick = styled('div')`
  position: absolute;
  display: flex;
  flex-direction: column-reverse;
  width: 4px;
  height: 14px;
  overflow: hidden;
`;

const StackedJobTickSegment = styled('div')`
  width: 100%;
  min-height: 1px;
  flex-shrink: 0;
`;
