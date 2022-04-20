import React from 'react';
import styled from '@emotion/styled';
import range from 'lodash/range';
import moment from 'moment';

import {transformCrumbs} from 'sentry/components/events/interfaces/breadcrumbs/utils';
import space from 'sentry/styles/space';
import {Crumb, RawCrumb} from 'sentry/types/breadcrumbs';

import {countColumns, formatTime} from '../utils';

import StackedContent from './stackedContent';

const EVENT_STICK_MARKER_WIDTH = 2;

interface Props {
  data: {
    values: Array<RawCrumb>;
  };
}

type LineStyle = 'dotted' | 'solid' | 'none';

function ReplayBreadcrumbOverview({data}: Props) {
  const transformedCrumbs = transformCrumbs(data.values);

  return (
    <StackedContent>
      {({width}) => (
        <React.Fragment>
          <Ticks
            crumbs={transformedCrumbs}
            width={width}
            minWidth={20}
            lineStyle="dotted"
          />
          <Ticks
            crumbs={transformedCrumbs}
            width={width}
            showTimestamp
            minWidth={50}
            lineStyle="solid"
          />
          <Events crumbs={transformedCrumbs} width={width} />
        </React.Fragment>
      )}
    </StackedContent>
  );
}

function Ticks({
  crumbs,
  width,
  minWidth = 50,
  showTimestamp,
  lineStyle = 'solid',
}: {
  crumbs: Crumb[];
  lineStyle: LineStyle;
  width: number;
  minWidth?: number;
  showTimestamp?: boolean;
}) {
  const startTime = crumbs[0]?.timestamp;
  const endTime = crumbs[crumbs.length - 1]?.timestamp;

  const startMilliSeconds = moment(startTime).valueOf();
  const endMilliSeconds = moment(endTime).valueOf();
  const duration = endMilliSeconds - startMilliSeconds;

  const {timespan, cols, remaining} = countColumns(duration, width, minWidth);

  return (
    <TimelineMarkerList totalColumns={cols} remainder={remaining}>
      {range(0, cols).map((_, i) => (
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

const TickMarker = styled('li')<{lineStyle: LineStyle}>`
  border-right: 2px ${p => p.lineStyle} ${p => p.theme.gray100};
  text-align: right;
`;

function Events({crumbs, width}: {crumbs: Crumb[]; width: number}) {
  const startTime = crumbs[0]?.timestamp;
  const endTime = crumbs[crumbs.length - 1]?.timestamp;

  const startMilliSeconds = moment(startTime).valueOf();
  const endMilliSeconds = moment(endTime).valueOf();

  const totalColumns = Math.floor(width / EVENT_STICK_MARKER_WIDTH);
  const duration = endMilliSeconds - startMilliSeconds;

  const eventsByCol = crumbs.reduce<Map<number, Crumb[]>>((map, breadcrumb) => {
    const {timestamp} = breadcrumb;
    const timestampMilliSeconds = moment(timestamp).valueOf();
    const sinceStart = timestampMilliSeconds - startMilliSeconds;
    const column = Math.floor((sinceStart / duration) * (totalColumns - 1)) + 1;
    map.set(column, [...Array.from(map.get(column) || []), breadcrumb]);
    return map;
  }, new Map());

  return (
    <div style={{paddingTop: space(4)}}>
      <TimelineMarkerList totalColumns={totalColumns} remainder={0}>
        {Array.from(eventsByCol.entries()).map(([column, breadcrumbs]) => (
          <EventColumn key={column} column={Number(column)}>
            <EventMarkerList breadcrumbs={breadcrumbs} />
          </EventColumn>
        ))}
      </TimelineMarkerList>
    </div>
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
