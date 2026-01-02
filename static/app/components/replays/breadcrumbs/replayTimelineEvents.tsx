import type {Theme} from '@emotion/react';
import {css, useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import {Tooltip} from 'sentry/components/core/tooltip';
import BreadcrumbItem from 'sentry/components/replays/breadcrumbs/breadcrumbItem';
import * as Timeline from 'sentry/components/replays/breadcrumbs/timeline';
import {getFramesByColumn} from 'sentry/components/replays/utils';
import {space} from 'sentry/styles/space';
import {uniq} from 'sentry/utils/array/uniq';
import getFrameDetails from 'sentry/utils/replays/getFrameDetails';
import useActiveReplayTab from 'sentry/utils/replays/hooks/useActiveReplayTab';
import useCrumbHandlers from 'sentry/utils/replays/hooks/useCrumbHandlers';
import type {ReplayFrame} from 'sentry/utils/replays/types';
import type {GraphicsVariant} from 'sentry/utils/theme';

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
  pointer-events: auto;

  place-items: stretch;
  display: grid;
  align-items: center;
  position: relative;

  &:hover {
    z-index: ${p => p.theme.zIndex.initial};
  }
`;

type GraphicsVariantTrio =
  | [GraphicsVariant]
  | [GraphicsVariant, GraphicsVariant]
  | [GraphicsVariant, GraphicsVariant, GraphicsVariant];

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
      allowShowSnippet={false}
      frame={frame}
      showSnippet={false}
      key={i}
      onClick={() => {
        onClickTimestamp(frame);
        setActiveTab(getFrameDetails(frame).tabKey);
      }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      startTimestampMs={startTimestampMs}
      onInspectorExpanded={() => {}}
      onShowSnippet={() => {}}
    />
  ));
  const title = <TooltipWrapper>{buttons}</TooltipWrapper>;

  const overlayStyle = css`
    /* We make sure to override existing styles */
    padding: ${space(0.5)} !important;
    max-width: 291px !important;
    width: 291px;

    @media screen and (max-width: ${theme.breakpoints.sm}) {
      max-width: 220px !important;
    }
  `;

  const firstFrame = frames.at(0);

  // We want to show the full variety of colors available.
  const uniqueColorTokens = uniq(
    frames.map(frame => getFrameDetails(frame).colorGraphicsToken)
  );

  // We just need to stack up to 3 times
  const frameCount = Math.min(uniqueColorTokens.length, 3);

  // Sort the frame colors by color priority
  const colorOrder = [
    'danger',
    'warning',
    'success',
    'accent',
    'muted',
  ] as readonly GraphicsVariant[];
  const getColorPos = (c: GraphicsVariant) => colorOrder.indexOf(c);
  const sortedUniqueColorTokens = uniqueColorTokens
    .toSorted((x, y) => getColorPos(x) - getColorPos(y))
    .slice(0, 3) as GraphicsVariantTrio;

  return (
    <IconPosition style={{marginLeft: `${markerWidth / 2}px`}}>
      <Tooltip
        title={title}
        overlayStyle={overlayStyle}
        containerDisplayMode="grid"
        isHoverable
      >
        <IconNode
          colorTokens={sortedUniqueColorTokens}
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
  translate: -50% 0;
`;

const getBackgroundGradient = ({
  colorTokens,
  frameCount,
  theme,
}: {
  colorTokens: GraphicsVariantTrio;
  frameCount: number;
  theme: Theme;
}) => {
  const c0 = theme.tokens.graphics[colorTokens[0]];
  const c1 = colorTokens[1] ? theme.tokens.graphics[colorTokens[1]] : c0;
  const c2 = colorTokens[2] ? theme.tokens.graphics[colorTokens[2]] : c1;

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

const IconNode = styled('button')<{
  colorTokens: GraphicsVariantTrio;
  frameCount: number;
}>`
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
