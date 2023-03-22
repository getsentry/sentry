import {css, Theme, useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import BreadcrumbItem from 'sentry/components/replays/breadcrumbs/breadcrumbItem';
import * as Timeline from 'sentry/components/replays/breadcrumbs/timeline';
import {getCrumbsByColumn} from 'sentry/components/replays/utils';
import {Tooltip} from 'sentry/components/tooltip';
import {space} from 'sentry/styles/space';
import {Crumb} from 'sentry/types/breadcrumbs';
import useCrumbHandlers from 'sentry/utils/replays/hooks/useCrumbHandlers';
import type {Color} from 'sentry/utils/theme';

const NODE_SIZES = [8, 12, 16];

type Props = {
  crumbs: Crumb[];
  durationMs: number;
  startTimestampMs: number;
  width: number;
  className?: string;
};

function ReplayTimelineEvents({
  className,
  crumbs,
  durationMs,
  startTimestampMs,
  width,
}: Props) {
  const markerWidth = crumbs.length < 200 ? 4 : crumbs.length < 500 ? 6 : 10;

  const totalColumns = Math.floor(width / markerWidth);
  const eventsByCol = getCrumbsByColumn(
    startTimestampMs,
    durationMs,
    crumbs,
    totalColumns
  );

  return (
    <Timeline.Columns className={className} totalColumns={totalColumns} remainder={0}>
      {Array.from(eventsByCol.entries()).map(([column, breadcrumbs]) => (
        <EventColumn key={column} column={column}>
          <Event
            crumbs={breadcrumbs}
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
  crumbs,
  markerWidth,
  startTimestampMs,
}: {
  crumbs: Crumb[];
  markerWidth: number;
  startTimestampMs: number;
}) {
  const theme = useTheme();
  const {handleMouseEnter, handleMouseLeave, handleClick} =
    useCrumbHandlers(startTimestampMs);

  const buttons = crumbs.map(crumb => (
    <BreadcrumbItem
      crumb={crumb}
      isCurrent={false}
      isHovered={false}
      key={crumb.id}
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
  const uniqueColors = Array.from(new Set(crumbs.map(crumb => crumb.color)));

  // We just need to stack up to 3 times
  const crumbCount = Math.min(crumbs.length, 3);

  return (
    <IconPosition markerWidth={markerWidth}>
      <IconNodeTooltip title={title} overlayStyle={overlayStyle} isHoverable>
        <IconNode colors={uniqueColors} crumbCount={crumbCount} />
      </IconNodeTooltip>
    </IconPosition>
  );
}

const IconNodeTooltip = styled(Tooltip)`
  display: grid;
  justify-items: center;
  align-items: center;
`;

const IconPosition = styled('div')<{markerWidth: number}>`
  position: absolute;
  transform: translate(-50%);
  margin-left: ${p => p.markerWidth / 2}px;
`;

const getBackgroundGradient = ({
  colors,
  crumbCount,
  theme,
}: {
  colors: Color[];
  crumbCount: number;
  theme: Theme;
}) => {
  const c0 = theme[colors[0]] ?? colors[0];
  const c1 = theme[colors[1]] ?? colors[1] ?? c0;
  const c2 = theme[colors[2]] ?? colors[2] ?? c1;

  if (crumbCount === 1) {
    return `background: ${c0};`;
  }
  if (crumbCount === 2) {
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

const IconNode = styled('div')<{colors: Color[]; crumbCount: number}>`
  grid-column: 1;
  grid-row: 1;
  width: ${p => NODE_SIZES[p.crumbCount - 1]}px;
  height: ${p => NODE_SIZES[p.crumbCount - 1]}px;
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
