import styled from '@emotion/styled';

import type {GroupOpenPeriod} from 'sentry/types/group';

import type {TimeWindowConfig} from './types';

interface OpenPeriodTimelineProps {
  openPeriods: GroupOpenPeriod[];
  timeWindowConfig: TimeWindowConfig;
  className?: string;
  style?: React.CSSProperties;
}

interface PositionedOpenPeriod extends GroupOpenPeriod {
  left: number;
  width: number;
}

function getOpenPeriodPosition(timestamp: Date, timelineStart: Date, msPerPixel: number) {
  const elapsedSinceStart = timestamp.getTime() - timelineStart.getTime();
  return elapsedSinceStart / msPerPixel;
}

function calculateOpenPeriodPositions(
  openPeriods: GroupOpenPeriod[],
  timeWindowConfig: TimeWindowConfig
): PositionedOpenPeriod[] {
  const {start, end, timelineWidth, rollupConfig} = timeWindowConfig;
  const elapsedMs = end.getTime() - start.getTime();
  const totalWidth = timelineWidth + rollupConfig.timelineUnderscanWidth;
  const msPerPixel = elapsedMs / totalWidth;

  return openPeriods.map(period => {
    const periodStart = new Date(period.start);
    const periodEnd = new Date(period.end);

    const left = Math.max(0, getOpenPeriodPosition(periodStart, start, msPerPixel));
    const right = Math.min(
      timelineWidth,
      getOpenPeriodPosition(periodEnd, start, msPerPixel)
    );
    const width = Math.max(2, right - left); // Minimum width of 2px

    return {
      ...period,
      left,
      width,
    };
  });
}

export function OpenPeriodTimeline({
  openPeriods,
  timeWindowConfig,
  className,
  style,
}: OpenPeriodTimelineProps) {
  const positionedPeriods = calculateOpenPeriodPositions(openPeriods, timeWindowConfig);

  return (
    <TimelineContainer role="figure" className={className} style={style}>
      {positionedPeriods.map((period, index) => (
        <OpenPeriodBar
          key={`${period.start}-${index}`}
          style={{
            left: period.left,
            width: period.width,
          }}
          isOpen={period.isOpen}
        />
      ))}
    </TimelineContainer>
  );
}

const TimelineContainer = styled('div')`
  position: relative;
  width: 100%;
  overflow: hidden;
  height: 8px;
`;

const OpenPeriodBar = styled('div')<{isOpen: boolean}>`
  position: absolute;
  height: 8px;
  border-radius: 2px;
  background-color: ${p => p.theme.red300};
`;
