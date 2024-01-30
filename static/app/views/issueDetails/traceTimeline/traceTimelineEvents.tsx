import {Fragment} from 'react';
import styled from '@emotion/styled';

import DateTime from 'sentry/components/dateTime';
import {Tooltip} from 'sentry/components/tooltip';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Event} from 'sentry/types';
import {TraceTimelineTooltip} from 'sentry/views/issueDetails/traceTimeline/traceTimelineTooltip';

import type {TimelineEvent} from './useTraceTimelineEvents';
import {useTraceTimelineEvents} from './useTraceTimelineEvents';
import {getEventsByColumn} from './utils';

// Adjusting this will change the number of tooltip groups
const markerWidth = 24;
// Adjusting subwidth changes how many dots to render
const subWidth = 2;

interface TraceTimelineEventsProps {
  event: Event;
  width: number;
}

export function TraceTimelineEvents({event, width}: TraceTimelineEventsProps) {
  const {startTimestamp, endTimestamp, data} = useTraceTimelineEvents({event});
  let durationMs = endTimestamp - startTimestamp;
  // Will need to figure out padding
  if (durationMs === 0) {
    durationMs = 1000;
  }

  const totalColumns = Math.floor(width / markerWidth);
  const framesByCol = getEventsByColumn(durationMs, data, totalColumns, startTimestamp);
  const columnSize = width / totalColumns;

  return (
    <Fragment>
      <TimelineColumns totalColumns={totalColumns}>
        {Array.from(framesByCol.entries()).map(([column, colEvents]) => {
          // Calculate the timestamp range that this column represents
          const columnStartTimestamp =
            (durationMs / totalColumns) * (column - 1) + startTimestamp;
          const columnEndTimestamp =
            (durationMs / totalColumns) * column + startTimestamp;
          return (
            <EventColumn
              key={column}
              style={{gridColumn: Math.floor(column), width: columnSize}}
            >
              <NodeGroup
                event={event}
                colEvents={colEvents}
                columnSize={columnSize}
                timerange={[columnStartTimestamp, columnEndTimestamp]}
                currentEventId={event.id}
              />
            </EventColumn>
          );
        })}
      </TimelineColumns>
      <TimestampColumns>
        <TimestampItem style={{textAlign: 'left'}}>
          <DateTime date={startTimestamp} timeOnly />
        </TimestampItem>
        <TimestampItem style={{textAlign: 'center'}}>
          <DateTime date={startTimestamp + Math.floor(durationMs / 2)} timeOnly />
        </TimestampItem>
        <TimestampItem style={{textAlign: 'right'}}>
          <DateTime date={endTimestamp} timeOnly />
        </TimestampItem>
      </TimestampColumns>
    </Fragment>
  );
}

/**
 * Use grid to create columns that we can place child nodes into.
 * Leveraging grid for alignment means we don't need to calculate percent offset
 * nor use position:absolute to lay out items.
 *
 * <Columns>
 *   <Col>...</Col>
 *   <Col>...</Col>
 * </Columns>
 */
const TimelineColumns = styled('ul')<{totalColumns: number}>`
  /* Reset defaults for <ul> */
  list-style: none;
  margin: 0;
  padding: 0;

  /* Layout of the lines */
  display: grid;
  grid-template-columns: repeat(${p => p.totalColumns}, 1fr);
  margin-top: -1px;
`;

const TimestampColumns = styled('div')`
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  margin-top: ${space(1)};
`;

const TimestampItem = styled('div')`
  place-items: stretch;
  display: grid;
  align-items: center;
  position: relative;
  color: ${p => p.theme.subText};
  font-size: ${p => p.theme.fontSizeSmall};
`;

function NodeGroup({
  event,
  timerange,
  colEvents,
  columnSize,
  currentEventId,
}: {
  colEvents: TimelineEvent[];
  columnSize: number;
  currentEventId: string;
  event: Event;
  timerange: [number, number];
}) {
  const totalSubColumns = Math.floor(columnSize / subWidth);
  const durationMs = timerange[1] - timerange[0];
  const framesByCol = getEventsByColumn(
    durationMs,
    colEvents,
    totalSubColumns,
    timerange[1]
  );

  return (
    <Tooltip
      title={<TraceTimelineTooltip event={event} frames={colEvents} />}
      overlayStyle={{
        padding: `0 !important`,
        maxWidth: '250px !important',
        width: '250px',
      }}
      offset={10}
      position="bottom"
      isHoverable
      skipWrapper
    >
      <TimelineColumns totalColumns={totalSubColumns}>
        {Array.from(framesByCol.entries()).map(([column, groupFrames]) => (
          <EventColumn key={column} style={{gridColumn: Math.floor(column)}}>
            {groupFrames.map(frame => (
              // TODO: use sentry colors and add the other styles
              <IconNode
                key={frame.id}
                aria-label={frame.id === currentEventId ? t('Current Event') : undefined}
                style={
                  frame.id === currentEventId
                    ? {
                        backgroundColor: 'rgb(181, 19, 7, 1)',
                        outline: '1px solid rgb(181, 19, 7, 0.5)',
                        outlineOffset: '3px',
                      }
                    : undefined
                }
              />
            ))}
          </EventColumn>
        ))}
      </TimelineColumns>
    </Tooltip>
  );
}

const EventColumn = styled('li')`
  place-items: stretch;
  display: grid;
  align-items: center;
  position: relative;

  &:hover {
    z-index: ${p => p.theme.zIndex.initial};
  }
`;

const IconNode = styled('div')`
  position: absolute;
  grid-column: 1;
  grid-row: 1;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  color: ${p => p.theme.white};
  box-shadow: ${p => p.theme.dropShadowLight};
  user-select: none;
  background-color: rgb(181, 19, 7, 0.2);
`;
