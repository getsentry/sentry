import type {Theme} from '@emotion/react';
import {css, useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import BreadcrumbItem from 'sentry/components/replays/breadcrumbs/breadcrumbItem';
import * as Timeline from 'sentry/components/replays/breadcrumbs/timeline';
import {getFramesByColumn} from 'sentry/components/replays/utils';
import {Tooltip} from 'sentry/components/tooltip';
import {space} from 'sentry/styles/space';
import {uniq} from 'sentry/utils/array/uniq';
import getFrameDetails from 'sentry/utils/replays/getFrameDetails';
import useActiveReplayTab from 'sentry/utils/replays/hooks/useActiveReplayTab';
import useCrumbHandlers from 'sentry/utils/replays/hooks/useCrumbHandlers';
import type {ReplayFrame} from 'sentry/utils/replays/types';
import type {Color} from 'sentry/utils/theme';

const NODE_SIZES = [8, 12, 16];

interface Props {
  durationMs: number;
  frames: ReplayFrame[];
  startTimestampMs: number;
  width: number;
  className?: string;
}

export default function ReplayTimelineEvents({
  className,
  durationMs,
  frames,
  startTimestampMs,
  width,
}: Props) {
  const markerWidth = frames.length < 200 ? 4 : frames.length < 500 ? 6 : 10;

  const totalColumns = Math.floor(width / markerWidth);
  const framesByCol = getFramesByColumn(durationMs, frames, totalColumns);

  return (
    <Timeline.Columns className={className} totalColumns={totalColumns} remainder={0}>
      {Array.from(framesByCol.entries()).map(([column, colFrames]) => (
        <EventColumn key={column} style={{gridColumn: Math.floor(column)}}>
          <Event
            frames={colFrames}
            markerWidth={markerWidth}
            startTimestampMs={startTimestampMs}
          />
        </EventColumn>
      ))}
    </Timeline.Columns>
  );
}

const EventColumn = styled(Timeline.Col)`
  place-items: stretch;
  display: grid;
  align-items: center;
  position: relative;

  &:hover {
    z-index: ${p => p.theme.zIndex.initial};
  }
`;

function Event({
  frames,
  markerWidth,
  startTimestampMs,
}: {
  frames: ReplayFrame[];
  markerWidth: number;
  startTimestampMs: number;
}) {
  const theme = useTheme();
  const {onMouseEnter, onMouseLeave, onClickTimestamp} = useCrumbHandlers();
  const {setActiveTab} = useActiveReplayTab({});

  const buttons = frames.map((frame, i) => (
    <BreadcrumbItem
      frame={frame}
      extraction={undefined}
      key={i}
      onClick={() => {
        onClickTimestamp(frame);
        setActiveTab(getFrameDetails(frame).tabKey);
      }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      startTimestampMs={startTimestampMs}
      onInspectorExpanded={() => {}}
    />
  ));
  const title = <TooltipWrapper>{buttons}</TooltipWrapper>;

  const overlayStyle = css`
    /* We make sure to override existing styles */
    padding: ${space(0.5)} !important;
    max-width: 291px !important;
    width: 291px;

    @media screen and (max-width: ${theme.breakpoints.small}) {
      max-width: 220px !important;
    }
  `;

  const firstFrame = frames.at(0);

  // We want to show the full variety of colors available.
  const uniqueColors = uniq(frames.map(frame => getFrameDetails(frame).color));

  // We just need to stack up to 3 times
  const frameCount = Math.min(uniqueColors.length, 3);

  // Sort the frame colors by color priority
  // Priority order: red300, yellow300, green300, purple300, gray300
  const sortedUniqueColors = uniqueColors.sort(function (x, y) {
    const colorOrder: Color[] = [
      'red300',
      'yellow300',
      'green300',
      'purple300',
      'gray300',
    ];
    function getColorPos(c: Color) {
      return colorOrder.indexOf(c);
    }
    return getColorPos(x) - getColorPos(y);
  });

  return (
    <IconPosition style={{marginLeft: `${markerWidth / 2}px`}}>
      <Tooltip
        title={title}
        overlayStyle={overlayStyle}
        containerDisplayMode="grid"
        isHoverable
      >
        <IconNode
          colors={sortedUniqueColors}
          frameCount={frameCount}
          onClick={() => {
            if (firstFrame) {
              onClickTimestamp(firstFrame);
            }
          }}
        />
      </Tooltip>
    </IconPosition>
  );
}

const IconPosition = styled('div')`
  position: absolute;
  transform: translate(-50%);
`;

const getBackgroundGradient = ({
  colors,
  frameCount,
  theme,
}: {
  colors: Color[];
  frameCount: number;
  theme: Theme;
}) => {
  const c0 = theme[colors[0]!] ?? colors[0]!;
  const c1 = theme[colors[1]!] ?? colors[1]! ?? c0;
  const c2 = theme[colors[2]!] ?? colors[2]! ?? c1;

  if (frameCount === 1) {
    return `background: ${c0};`;
  }
  if (frameCount === 2) {
    return `
      background: ${c0};
      background: radial-gradient(
        circle at center,
        ${c1} 30%,
        ${c0} 30%
      );`;
  }
  return `
    background: ${c0};
    background: radial-gradient(
      circle at center,
      ${c2} 30%,
      ${c1} 30%,
      ${c1} 50%,
      ${c0} 50%
    );`;
};

const IconNode = styled('button')<{colors: Color[]; frameCount: number}>`
  padding: 0;
  border: none;
  grid-column: 1;
  grid-row: 1;
  width: ${p => NODE_SIZES[p.frameCount - 1]}px;
  height: ${p => NODE_SIZES[p.frameCount - 1]}px;
  border-radius: 50%;
  color: ${p => p.theme.white};
  ${getBackgroundGradient}
  box-shadow: ${p => p.theme.dropShadowLight};
  user-select: none;
`;

const TooltipWrapper = styled('div')`
  max-height: 80vh;
  overflow: auto;
`;
