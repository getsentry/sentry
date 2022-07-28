import {useCallback} from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';

import * as Timeline from 'sentry/components/replays/breadcrumbs/timeline';
import {useReplayContext} from 'sentry/components/replays/replayContext';
import {getCrumbsByColumn, relativeTimeInMs} from 'sentry/components/replays/utils';
import Tooltip from 'sentry/components/tooltip';
import space from 'sentry/styles/space';
import {Crumb} from 'sentry/types/breadcrumbs';
import type {Color} from 'sentry/utils/theme';
import theme from 'sentry/utils/theme';
import BreadcrumbItem from 'sentry/views/replays/detail/breadcrumbs/breadcrumbItem';

const EVENT_STICK_MARKER_WIDTH = 4;

type Props = {
  crumbs: Crumb[];
  duration: number;
  startTimestampMS: number;
  width: number;
  className?: string;
};

function ReplayTimelineEvents({
  className,
  crumbs,
  duration,
  startTimestampMS,
  width,
}: Props) {
  const totalColumns = Math.floor(width / EVENT_STICK_MARKER_WIDTH);
  const eventsByCol = getCrumbsByColumn(startTimestampMS, duration, crumbs, totalColumns);

  return (
    <Timeline.Columns className={className} totalColumns={totalColumns} remainder={0}>
      {Array.from(eventsByCol.entries()).map(([column, breadcrumbs]) => (
        <EventColumn key={column} column={column}>
          <Event crumbs={breadcrumbs} startTimestampMS={startTimestampMS} />
        </EventColumn>
      ))}
    </Timeline.Columns>
  );
}

const EventColumn = styled(Timeline.Col)<{column: number}>`
  grid-column: ${p => Math.floor(p.column)};
  place-items: stretch;
  display: grid;

  &:hover {
    z-index: ${p => p.theme.zIndex.initial};
  }
`;

function Event({
  crumbs,
  startTimestampMS,
}: {
  crumbs: Crumb[];
  startTimestampMS: number;
  className?: string;
}) {
  const {setCurrentTime} = useReplayContext();

  const handleClick = useCallback(
    (crumb: Crumb) => {
      crumb.timestamp !== undefined
        ? setCurrentTime(relativeTimeInMs(crumb.timestamp, startTimestampMS))
        : null;
    },
    [setCurrentTime, startTimestampMS]
  );

  const title = crumbs.map(crumb => (
    <BreadcrumbItem
      key={crumb.id}
      crumb={crumb}
      startTimestampMS={startTimestampMS}
      isHovered={false}
      isSelected={false}
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
    <IconPosition>
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

const IconPosition = styled('div')`
  position: absolute;
  transform: translate(-50%);
  margin-left: ${EVENT_STICK_MARKER_WIDTH / 2}px;
  align-self: center;
  display: grid;
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
