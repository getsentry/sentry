import {Fragment, useMemo} from 'react';
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
  const {startTimestamp, endTimestamp, traceEvents} = useTraceTimelineEvents({event});
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
  const eventsByColumn = useMemo(
    () => getEventsByColumn(traceEvents, durationMs, totalColumns, paddedStartTime),
    [durationMs, traceEvents, totalColumns, paddedStartTime]
  );

  const columnSize = width / totalColumns;

  // If the duration is less than 2 minutes, show seconds
  const showTimelineSeconds = durationMs < 120 * 1000;
  const middleTimestamp = paddedStartTime + Math.floor(durationMs / 2);
  const leftMiddleTimestamp = paddedStartTime + Math.floor(durationMs / 4);
  const rightMiddleTimestamp = paddedStartTime + Math.floor((durationMs / 4) * 3);

  return (
    <Fragment>
      {/* Add padding to the total columns, 1 column of padding on each side */}
      <TimelineColumns style={{gridTemplateColumns: `repeat(${totalColumns + 2}, 1fr)`}}>
        {eventsByColumn.map(([column, colEvents]) => {
          // Calculate the timestamp range that this column represents
          const timeRange = getChunkTimeRange(
            paddedStartTime,
            column - 1,
            durationMs / totalColumns
          );
          const hasCurrentEvent = colEvents.some(e => e.id === event.id);
          return (
            <EventColumn
              key={`${column}-${hasCurrentEvent ? 'current-event' : 'regular'}`}
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
        <DateTime date={paddedStartTime} seconds={showTimelineSeconds} timeOnly />
        <DateTime date={leftMiddleTimestamp} seconds={showTimelineSeconds} timeOnly />
        <DateTime date={middleTimestamp} seconds={showTimelineSeconds} timeOnly />
        <DateTime date={rightMiddleTimestamp} seconds={showTimelineSeconds} timeOnly />
        <DateTime date={paddedEndTime} seconds={showTimelineSeconds} timeOnly />
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
const TimelineColumns = styled('div')`
  /* Reset defaults for <ul> */
  list-style: none;
  margin: 0;
  padding: 0;

  /* Layout of the lines */
  display: grid;
  margin-top: -1px;
  height: 0;
`;

const TimestampColumns = styled('div')`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: ${space(1)};
  text-align: center;
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
  const {eventsByColumn, columns} = useMemo(() => {
    const durationMs = timeRange[1] - timeRange[0];
    const eventColumns = getEventsByColumn(
      colEvents,
      durationMs,
      totalSubColumns,
      timeRange[0]
    );
    return {
      eventsByColumn: eventColumns,
      columns: eventColumns.map<number>(([column]) => column).sort(),
    };
  }, [colEvents, totalSubColumns, timeRange]);

  return (
    <Fragment>
      <TimelineColumns style={{gridTemplateColumns: `repeat(${totalSubColumns}, 1fr)`}}>
        {eventsByColumn.map(([column, groupEvents]) => {
          const isCurrentNode = groupEvents.some(e => e.id === currentEventId);
          return (
            <EventColumn key={`${column}-currrent-event`} style={{gridColumn: column}}>
              {isCurrentNode ? (
                <CurrentNodeContainer aria-label={t('Current Event')}>
                  <CurrentNodeRing />
                  <CurrentIconNode />
                </CurrentNodeContainer>
              ) : (
                groupEvents
                  .slice(0, 5)
                  .map(groupEvent =>
                    'event.type' in groupEvent ? (
                      <IconNode key={groupEvent.id} />
                    ) : (
                      <PerformanceIconNode key={groupEvent.id} />
                    )
                  )
              )}
            </EventColumn>
          );
        })}
      </TimelineColumns>
      <TimelineColumns style={{gridTemplateColumns: `repeat(${totalSubColumns}, 1fr)`}}>
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
              gridColumn:
                columns.length > 1
                  ? `${columns.at(0)} / ${columns.at(-1)}`
                  : columns.at(0)!,
              width: 8 * columns.length,
            }}
            data-test-id={`trace-timeline-tooltip-${currentColumn}`}
          />
        </Tooltip>
      </TimelineColumns>
    </Fragment>
  );
}

const EventColumn = styled('div')`
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
  margin-left: -8px;
`;

const PerformanceIconNode = styled(IconNode)`
  background-color: unset;
  border: 1px solid ${p => p.theme.red300};
`;

const CurrentNodeContainer = styled('div')`
  position: absolute;
  grid-column: 1;
  grid-row: 1;
  width: 12px;
  height: 12px;
`;

const CurrentNodeRing = styled('div')`
  border: 1px solid ${p => p.theme.red300};
  height: 24px;
  width: 24px;
  border-radius: 100%;
  position: absolute;
  top: -6px;
  left: -16px;
  animation: pulse 2s ease-out infinite;

  @keyframes pulse {
    0% {
      transform: scale(0.1, 0.1);
      opacity: 0;
    }
    50% {
      transform: scale(0.1, 0.1);
      opacity: 0;
    }
    70% {
      opacity: 1;
    }
    100% {
      transform: scale(1.2, 1.2);
      opacity: 0;
    }
  }
`;

const CurrentIconNode = styled(IconNode)`
  background-color: ${p => p.theme.red300};
  width: 12px;
  height: 12px;
  margin-left: -10px;
`;

const TooltipHelper = styled('span')`
  height: 12px;
  margin-left: -8px;
  margin-top: -6px;
  z-index: 1;
`;
