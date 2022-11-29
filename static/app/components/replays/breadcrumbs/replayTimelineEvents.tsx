import {css} from '@emotion/react';
import styled from '@emotion/styled';

import * as Timeline from 'sentry/components/replays/breadcrumbs/timeline';
import {getCrumbsByColumn} from 'sentry/components/replays/utils';
import Tooltip from 'sentry/components/tooltip';
import space from 'sentry/styles/space';
import {Crumb} from 'sentry/types/breadcrumbs';
import useCrumbHandlers from 'sentry/utils/replays/hooks/useCrumbHandlers';
import type {Color} from 'sentry/utils/theme';
import theme from 'sentry/utils/theme';
import BreadcrumbItem from 'sentry/views/replays/detail/breadcrumbs/breadcrumbItem';

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
  className?: string;
}) {
  const {handleMouseEnter, handleMouseLeave, handleClick} =
    useCrumbHandlers(startTimestampMs);

  const title = crumbs.map(crumb => (
    <BreadcrumbItem
      key={crumb.id}
      crumb={crumb}
      startTimestampMs={startTimestampMs}
      isHovered={false}
      isSelected={false}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={handleClick}
    />
  ));

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
  const colors = [...new Set(crumbs.map(crumb => crumb.color))];

  // We just need to stack up to 3 times
  const totalStackNumber = Math.min(crumbs.length, 3);

  return (
    <IconPosition markerWidth={markerWidth}>
      <IconNodeTooltip title={title} overlayStyle={overlayStyle} isHoverable>
        {crumbs.slice(0, totalStackNumber).map((crumb, index) => (
          <IconNode
            color={colors[index] || crumb.color}
            key={crumb.id}
            stack={{totalStackNumber, index}}
          />
        ))}
      </IconNodeTooltip>
    </IconPosition>
  );
}

const getNodeDimensions = ({
  stack,
}: {
  stack: {
    index: number;
    totalStackNumber: number;
  };
}) => {
  const {totalStackNumber, index} = stack;
  const multiplier = totalStackNumber - index;
  const size = (multiplier + 1) * 4;
  return `
    width: ${size}px;
    height: ${size}px;
  `;
};

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

const IconNode = styled('div')<{
  color: Color;
  stack: {
    index: number;
    totalStackNumber: number;
  };
}>`
  grid-column: 1;
  grid-row: 1;
  ${getNodeDimensions}
  border-radius: 50%;
  color: ${p => p.theme.white};
  background: ${p => p.theme[p.color] ?? p.color};
  box-shadow: ${p => p.theme.dropShadowLightest};
  user-select: none;
`;

export default ReplayTimelineEvents;
