import {css, Theme, useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import uniq from 'lodash/uniq';

import BreadcrumbItem from 'sentry/components/replays/breadcrumbs/breadcrumbItem';
import * as Timeline from 'sentry/components/replays/breadcrumbs/timeline';
import {getFramesByColumn} from 'sentry/components/replays/utils';
import {Tooltip} from 'sentry/components/tooltip';
import {space} from 'sentry/styles/space';
import {getColor} from 'sentry/utils/replays/frame';
import useCrumbHandlers from 'sentry/utils/replays/hooks/useCrumbHandlers';
import type {ReplayFrame} from 'sentry/utils/replays/types';
import type {Color} from 'sentry/utils/theme';

const NODE_SIZES = [8, 12, 16];

type Props = {
  durationMs: number;
  frames: ReplayFrame[];
  startTimestampMs: number;
  width: number;
  className?: string;
};

function ReplayTimelineEvents({
  className,
  frames,
  durationMs,
  startTimestampMs,
  width,
}: Props) {
  const markerWidth = frames.length < 200 ? 4 : frames.length < 500 ? 6 : 10;

  const totalColumns = Math.floor(width / markerWidth);
  const framesByCol = getFramesByColumn(durationMs, frames, totalColumns);

  return (
    <Timeline.Columns className={className} totalColumns={totalColumns} remainder={0}>
      {Array.from(framesByCol.entries()).map(([column, colFrames]) => (
        <EventColumn key={column} column={column}>
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

const EventColumn = styled(Timeline.Col)<{column: number}>`
  grid-column: ${p => Math.floor(p.column)};
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
  const {handleMouseEnter, handleMouseLeave, handleClick} =
    useCrumbHandlers(startTimestampMs);

  const buttons = frames.map((frame, i) => (
    <BreadcrumbItem
      crumb={frame}
      key={i}
      onClick={handleClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      startTimestampMs={startTimestampMs}
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

  // If we have more than 3 events we want to make sure of showing all the different colors that we have
  const uniqueColors = uniq(frames.map(getColor));

  // We just need to stack up to 3 times
  const frameCount = Math.min(frames.length, 3);

  return (
    <IconPosition style={{marginLeft: `${markerWidth / 2}px`}}>
      <IconNodeTooltip title={title} overlayStyle={overlayStyle} isHoverable>
        <IconNode colors={uniqueColors} frameCount={frameCount} />
      </IconNodeTooltip>
    </IconPosition>
  );
}

const IconNodeTooltip = styled(Tooltip)`
  display: grid;
  justify-items: center;
  align-items: center;
`;

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
  const c0 = theme[colors[0]] ?? colors[0];
  const c1 = theme[colors[1]] ?? colors[1] ?? c0;
  const c2 = theme[colors[2]] ?? colors[2] ?? c1;

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

const IconNode = styled('div')<{colors: Color[]; frameCount: number}>`
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
  max-height: calc(100vh - ${space(4)});
  overflow: auto;
`;

export default ReplayTimelineEvents;
