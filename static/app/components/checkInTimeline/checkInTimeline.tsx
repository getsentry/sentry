import {css} from '@emotion/react';
import styled from '@emotion/styled';

import {Container} from '@sentry/scraps/layout';
import type {TooltipProps} from '@sentry/scraps/tooltip';

import {tn} from 'sentry/locale';

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
  statusStyle: TickStyle<Status>;
  timeWindowConfig: TimeWindowConfig;
  className?: string;
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
  makeUnit = count => tn('check-in', 'check-ins', count),
  tooltipProps,
}: CheckInTimelineProps<Status>) {
  const jobTicks = mergeBuckets(
    statusPrecedent,
    timeWindowConfig.rollupConfig,
    bucketedData
  );

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
            <JobTick
              style={{left, width}}
              css={theme => getTickStyle(statusStyle, status, theme)}
              roundedLeft={isStarting && left !== 0}
              roundedRight={isEnding && left + width !== timeWindowConfig.timelineWidth}
              data-test-id="monitor-checkin-tick"
            />
          </CheckInTooltip>
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
    `}
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
    `}
  ${p =>
    !p.roundedRight &&
    css`
      border-right-width: 0;
    `}
`;
