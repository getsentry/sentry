import styled from '@emotion/styled';

import * as Timeline from 'sentry/components/replays/breadcrumbs/timeline';
import {Tooltip} from 'sentry/components/tooltip';
import type {Event} from 'sentry/types';

import type {TimelineTransactionEvent} from './useTraceTimelineEvents';
import {useTraceTimelineEvents} from './useTraceTimelineEvents';
import {getEventsByColumn} from './utils';

// Adjusting this will change the number of tooltip groups
const markerWidth = 20;

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
    <Timeline.Columns totalColumns={totalColumns} remainder={0}>
      {Array.from(framesByCol.entries()).map(([column, colFrames]) => {
        // Calculate the timestamp range that this column represents
        const columnStartTimestamp =
          (durationMs / totalColumns) * (column - 1) + startTimestamp;
        const columnEndTimestamp = (durationMs / totalColumns) * column + startTimestamp;
        return (
          <EventColumn
            key={column}
            style={{gridColumn: Math.floor(column), width: columnSize}}
          >
            <NodeGroup
              colFrames={colFrames}
              columnSize={columnSize}
              timerange={[columnStartTimestamp, columnEndTimestamp]}
              currentEventId={event.id}
            />
          </EventColumn>
        );
      })}
    </Timeline.Columns>
  );
}

function NodeGroup({
  timerange,
  colFrames,
  columnSize,
  currentEventId,
}: {
  colFrames: TimelineTransactionEvent[];
  columnSize: number;
  currentEventId: string;
  timerange: [number, number];
}) {
  // Adjusting subwidth changes how many dots to render
  const subWidth = 2;
  const totalSubColumns = Math.floor(columnSize / subWidth);
  const durationMs = timerange[1] - timerange[0];
  const framesByCol = getEventsByColumn(
    durationMs,
    colFrames,
    totalSubColumns,
    timerange[1]
  );

  // console.log({
  //   totalSubColumns,
  //   subGroups: framesByCol,
  //   subItems: new Set(colFrames.map(frame => frame.timestamp)).size,
  //   durationMs,
  // });

  return (
    <Tooltip
      title={
        <div>
          Total Items {colFrames.length}
          {[...new Set(colFrames.map(frame => frame.timestamp))].map((x, idx) => (
            <div key={idx}>{x}</div>
          ))}
        </div>
      }
      position="bottom"
      isHoverable
      skipWrapper
    >
      <Timeline.Columns totalColumns={totalSubColumns} remainder={0}>
        {Array.from(framesByCol.entries()).map(([column, groupFrames]) => (
          <EventColumn key={column} style={{gridColumn: Math.floor(column)}}>
            {groupFrames.map(frame => (
              <IconNode
                key={frame.id}
                style={
                  // TODO: use sentry colors
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
      </Timeline.Columns>
    </Tooltip>
  );
}

const EventColumn = styled(Timeline.Col)`
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
