import React from 'react';
import styled from '@emotion/styled';

import * as Timeline from 'sentry/components/replays/breadcrumbs/timeline';
import space from 'sentry/styles/space';
import {Crumb} from 'sentry/types/breadcrumbs';

import {getCrumbsByColumn} from '../utils';

const EVENT_STICK_MARKER_WIDTH = 2;

type Props = {
  crumbs: Crumb[];
  width: number;
  className?: string;
};

function ReplayTimelineEvents({className, crumbs, width}: Props) {
  const totalColumns = Math.floor(width / EVENT_STICK_MARKER_WIDTH);
  const eventsByCol = getCrumbsByColumn(crumbs, totalColumns);

  return (
    <Timeline.Columns className={className} totalColumns={totalColumns} remainder={0}>
      {Array.from(eventsByCol.entries()).map(([column, breadcrumbs]) => (
        <EventColumn key={column} column={column}>
          {breadcrumbs.map((breadcrumb, i) => (
            <EventStickMarker
              key={`${breadcrumb.timestamp}-${i}`}
              color={breadcrumb.color}
            />
          ))}
        </EventColumn>
      ))}
    </Timeline.Columns>
  );
}

const EventColumn = styled(Timeline.Col)<{column: number}>`
  grid-column: ${p => Math.floor(p.column)};
  place-items: stretch;
  height: 100%;
  min-height: ${space(4)};
  display: grid;
`;

const EventStickMarker = styled('div')<{color: string}>`
  width: ${EVENT_STICK_MARKER_WIDTH}px;
  background: ${p => p.theme[p.color] ?? p.color};
  /* Size only applies to the inside, not the border */
  box-sizing: content-box;
`;

export default ReplayTimelineEvents;
