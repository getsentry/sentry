import React from 'react';
import styled from '@emotion/styled';

import {transformCrumbs} from 'sentry/components/events/interfaces/breadcrumbs/utils';
import HorizontalMouseTracking from 'sentry/components/replays/player/horizontalMouseTracking';
import {TimelineScubber} from 'sentry/components/replays/player/scrubber';
import {useReplayContext} from 'sentry/components/replays/replayContext';
import StackedContent from 'sentry/components/replays/stackedContent';
import space from 'sentry/styles/space';
import {Crumb} from 'sentry/types/breadcrumbs';
import {EntryType} from 'sentry/types/event';

import {countColumns, formatTime, getCrumbsByColumn} from '../utils';

const EVENT_STICK_MARKER_WIDTH = 2;

interface Props {
  className?: string;
}

type LineStyle = 'dotted' | 'solid' | 'none';

function ReplayBreadcrumbOverview({className}: Props) {
  const {replay, duration} = useReplayContext();
  const crumbs = replay?.getEntryType(EntryType.BREADCRUMBS)?.data.values || [];
  const transformedCrumbs = transformCrumbs(crumbs);

  return (
    <HorizontalMouseTracking>
      <TimelineScubber />
      <StackedContent className={className}>
        {({width}) => (
          <React.Fragment>
            <Ticks
              duration={duration || 0}
              width={width}
              minWidth={20}
              lineStyle="dotted"
            />
            <Ticks
              duration={duration || 0}
              width={width}
              showTimestamp
              minWidth={50}
              lineStyle="solid"
            />

            <Events crumbs={transformedCrumbs} width={width} />
          </React.Fragment>
        )}
      </StackedContent>
    </HorizontalMouseTracking>
  );
}

function Ticks({
  duration,
  width,
  minWidth = 50,
  showTimestamp,
  lineStyle = 'solid',
}: {
  duration: number;
  lineStyle: LineStyle;
  width: number;
  minWidth?: number;
  showTimestamp?: boolean;
}) {
  const {timespan, cols, remaining} = countColumns(duration, width, minWidth);

  return (
    <TimelineMarkerList totalColumns={cols} remainder={remaining}>
      {[...Array(cols)].map((_, i) => (
        <TickMarker key={i} lineStyle={lineStyle}>
          {showTimestamp && <small>{formatTime((i + 1) * timespan)}</small>}
        </TickMarker>
      ))}
    </TimelineMarkerList>
  );
}

const TimelineMarkerList = styled('ul')<{remainder: number; totalColumns: number}>`
  /* Reset defaults for <ul> */
  list-style: none;
  margin: 0;
  padding: 0;

  height: 100%;
  width: 100%;

  /* Layout of the lines */
  display: grid;
  grid-template-columns: repeat(${p => p.totalColumns}, 1fr) ${p => p.remainder}fr;
  place-items: stretch;
`;

const OffsetTimelineMarkerList = styled(TimelineMarkerList)`
  padding-top: ${space(4)};
`;

const TickMarker = styled('li')<{lineStyle: LineStyle}>`
  border-right: 2px ${p => p.lineStyle} ${p => p.theme.gray100};
  text-align: right;
`;

function Events({crumbs, width}: {crumbs: Crumb[]; width: number}) {
  const totalColumns = Math.floor(width / EVENT_STICK_MARKER_WIDTH);
  const eventsByCol = getCrumbsByColumn(crumbs, totalColumns);

  return (
    <OffsetTimelineMarkerList totalColumns={totalColumns} remainder={0}>
      {Array.from(eventsByCol.entries()).map(([column, breadcrumbs]) => (
        <EventColumn key={column} column={column}>
          <EventMarkerList breadcrumbs={breadcrumbs} />
        </EventColumn>
      ))}
    </OffsetTimelineMarkerList>
  );
}

function EventMarkerList({breadcrumbs}: {breadcrumbs: Crumb[]}) {
  return (
    <React.Fragment>
      {breadcrumbs.map(breadcrumb => (
        <EventStickMarker key={breadcrumb.timestamp} color={breadcrumb.color} />
      ))}
    </React.Fragment>
  );
}

const EventColumn = styled('li')<{column: number}>`
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

export default ReplayBreadcrumbOverview;
