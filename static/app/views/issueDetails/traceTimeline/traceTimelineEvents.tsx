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
import {getChunkTimeRange, getEventsByColumn} from './utils';

// Adjusting this will change the number of tooltip groups
const PARENT_WIDTH = 12;
// Adjusting subwidth changes how many dots to render
const CHILD_WIDTH = 4;

interface TraceTimelineEventsProps {
  event: Event;
  width: number;
}

export function TraceTimelineEvents({event, width}: TraceTimelineEventsProps) {
  const {startTimestamp, endTimestamp, data} = useTraceTimelineEvents({event});
  let paddedStartTime = startTimestamp;
  let paddedEndTime = endTimestamp;
  // Duration is 0, pad both sides, this is how we end up with 1 dot in the middle
  if (endTimestamp - startTimestamp === 0) {
    // If the duration is 0, we need to pad the end time
    paddedEndTime = startTimestamp + 1500;
    paddedStartTime = startTimestamp - 1500;
  }
  const durationMs = paddedEndTime - paddedStartTime;

  const totalColumns = Math.floor(width / PARENT_WIDTH);
  const eventsByColumn = getEventsByColumn(
    durationMs,
    data,
    totalColumns,
    paddedStartTime
  );
  const columnSize = width / totalColumns;

  // If the duration is less than 2 minutes, show seconds
  const showTimelineSeconds = durationMs < 120 * 1000;

  return (
    <Fragment>
      {/* Add padding to the total columns, 1 column of padding on each side */}
      <TimelineColumns totalColumns={totalColumns + 2}>
        {Array.from(eventsByColumn.entries()).map(([column, colEvents]) => {
          // Calculate the timestamp range that this column represents
          const timeRange = getChunkTimeRange(
            paddedStartTime,
            column - 1,
            durationMs / totalColumns
          );
          return (
            <EventColumn
              key={column}
              // Add 1 to the column to account for the padding
              style={{gridColumn: Math.floor(column) + 1, width: columnSize}}
            >
              <NodeGroup
                event={event}
                colEvents={colEvents}
                columnSize={columnSize}
                timeRange={timeRange}
                currentEventId={event.id}
              />
            </EventColumn>
          );
        })}
      </TimelineColumns>
      <TimestampColumns>
        <TimestampItem style={{textAlign: 'left'}}>
          <DateTime date={paddedStartTime} seconds={showTimelineSeconds} timeOnly />
        </TimestampItem>
        <TimestampItem style={{textAlign: 'center'}}>
          <DateTime
            date={paddedStartTime + Math.floor(durationMs / 2)}
            seconds={showTimelineSeconds}
            timeOnly
          />
        </TimestampItem>
        <TimestampItem style={{textAlign: 'right'}}>
          <DateTime date={paddedEndTime} seconds={showTimelineSeconds} timeOnly />
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
  timeRange,
  colEvents,
  columnSize,
  currentEventId,
}: {
  colEvents: TimelineEvent[];
  columnSize: number;
  currentEventId: string;
  event: Event;
  timeRange: [number, number];
}) {
  const totalSubColumns = Math.floor(columnSize / CHILD_WIDTH);
  const durationMs = timeRange[1] - timeRange[0];
  const eventsByColumn = getEventsByColumn(
    durationMs,
    colEvents,
    totalSubColumns,
    timeRange[0]
  );

  return (
    <Tooltip
      title={<TraceTimelineTooltip event={event} timelineEvents={colEvents} />}
      overlayStyle={{
        padding: `0 !important`,
      }}
      offset={10}
      position="bottom"
      isHoverable
      skipWrapper
    >
      <TimelineColumns totalColumns={totalSubColumns}>
        {Array.from(eventsByColumn.entries()).map(([column, groupEvents]) => (
          <EventColumn key={column} style={{gridColumn: Math.floor(column)}}>
            {groupEvents.map(groupEvent => (
              // TODO: use sentry colors and add the other styles
              <IconNode
                key={groupEvent.id}
                aria-label={
                  groupEvent.id === currentEventId ? t('Current Event') : undefined
                }
                style={
                  groupEvent.id === currentEventId
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
