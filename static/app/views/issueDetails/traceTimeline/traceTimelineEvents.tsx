import {Fragment} from 'react';
import styled from '@emotion/styled';
import color from 'color';

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
                currentColumn={column}
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
  height: 0;
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
  currentColumn,
}: {
  colEvents: TimelineEvent[];
  columnSize: number;
  currentColumn: number;
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

  const columns = Array.from(eventsByColumn.keys());
  const minColumn = Math.min(...columns);
  const maxColumn = Math.max(...columns);

  return (
    <Fragment>
      <TimelineColumns totalColumns={totalSubColumns}>
        {Array.from(eventsByColumn.entries()).map(([column, groupEvents]) => {
          const isCurrentNode = groupEvents.some(e => e.id === currentEventId);
          return (
            <EventColumn key={column} style={{gridColumn: Math.floor(column)}}>
              {groupEvents.map(groupEvent => (
                <Fragment key={groupEvent.id}>
                  {isCurrentNode ? (
                    <CurrentNodeContainer aria-label={t('Current Event')}>
                      <CurrentNodeRing />
                      <CurrentIconNode />
                    </CurrentNodeContainer>
                  ) : !('event.type' in groupEvent) ? (
                    <PerformanceIconNode />
                  ) : (
                    <IconNode />
                  )}
                </Fragment>
              ))}
            </EventColumn>
          );
        })}
      </TimelineColumns>
      <TimelineColumns totalColumns={totalSubColumns}>
        <Tooltip
          title={<TraceTimelineTooltip event={event} timelineEvents={colEvents} />}
          overlayStyle={{
            padding: `0 !important`,
          }}
          position="bottom"
          isHoverable
          skipWrapper
        >
          <TooltipHelper
            style={{
              gridColumn: columns.length > 1 ? `${minColumn} / ${maxColumn}` : columns[0],
            }}
            data-test-id={`trace-timeline-tooltip-${currentColumn}`}
          />
        </Tooltip>
      </TimelineColumns>
    </Fragment>
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
  background-color: ${p => color(p.theme.red200).alpha(0.3).string()};
`;

const PerformanceIconNode = styled(IconNode)`
  background-color: unset;
  border: 1px solid ${p => color(p.theme.red300).alpha(0.3).string()};
`;

const CurrentNodeContainer = styled('div')`
  position: absolute;
  grid-column: 1;
  grid-row: 1;
  width: 8px;
  height: 8px;
`;

const CurrentNodeRing = styled('div')`
  border: 1px solid ${p => p.theme.red300};
  height: 16px;
  width: 16px;
  border-radius: 100%;
  position: absolute;
  top: -4px;
  left: -4px;
  animation: pulse 1s ease-out infinite;

  @keyframes pulse {
    0% {
      transform: scale(0.1, 0.1);
      opacity: 0.0;
    }
    50% {
      opacity: 1.0;
    }
    100% {
      transform: scale(1.2, 1.2);
      opacity: 0.0;
    }
  }
`;

const CurrentIconNode = styled(IconNode)`
  background-color: ${p => p.theme.red300};
  border-radius: 50%;
  position: absolute;
`;

const TooltipHelper = styled('span')`
  height: 8px;
  margin-top: -4px;
  margin-right: -2px;
  min-width: 8px;
  z-index: 1;
`;
