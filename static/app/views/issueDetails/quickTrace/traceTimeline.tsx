import {useRef} from 'react';
import styled from '@emotion/styled';

import Panel from 'sentry/components/panels/panel';
import Stacked from 'sentry/components/replays/breadcrumbs/stacked';
import * as Timeline from 'sentry/components/replays/breadcrumbs/timeline';
import {Tooltip} from 'sentry/components/tooltip';
import {Event} from 'sentry/types';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {getTraceTimeRangeFromEvent} from 'sentry/utils/performance/quickTrace/utils';
import {useApiQuery} from 'sentry/utils/queryClient';
import {useDimensions} from 'sentry/utils/useDimensions';
import useOrganization from 'sentry/utils/useOrganization';

interface TimelineTransactionEvent {
  id: string;
  issue: string;
  'issue.id': string;
  'project.name': string;
  timestamp: string;
  title: string;
}

function getEventTimestamp(start: number, event: TimelineTransactionEvent) {
  return new Date(event.timestamp).getTime() - start;
}

function getFramesByColumn(
  durationMs: number,
  frames: TimelineTransactionEvent[],
  totalColumns: number,
  start: number
) {
  const safeDurationMs = isNaN(durationMs) ? 1 : durationMs;

  const columnFramePairs = frames.map<[number, TimelineTransactionEvent]>(frame => {
    const columnPositionCalc =
      // Not sure math.abs is doing what i want
      Math.abs(
        Math.floor(
          (getEventTimestamp(start, frame) / safeDurationMs) * (totalColumns - 1)
        )
      ) + 1;

    // Should start at minimum in the first column
    const column = Math.max(1, columnPositionCalc);

    return [column, frame];
  });

  const framesByColumn = columnFramePairs.reduce((map, [column, frame]) => {
    if (map.has(column)) {
      map.get(column)?.push(frame);
    } else {
      map.set(column, [frame]);
    }
    return map;
  }, new Map<number, TimelineTransactionEvent[]>());

  return framesByColumn;
}

interface TraceTimelineProps {
  event: Event;
}

export function TraceTimeline({event}: TraceTimelineProps) {
  const {start, end} = getTraceTimeRangeFromEvent(event);
  const traceId = event.contexts?.trace?.trace_id ?? '';

  const organization = useOrganization();
  const {
    data: issuePlatformData,
    isLoading: isLoadingIssuePlatform,
    isError: isErrorIssuePlatform,
  } = useApiQuery<{
    data: TimelineTransactionEvent[];
    meta: unknown;
  }>(
    [
      `/organizations/${organization.slug}/events/`,
      {
        query: {
          // Get performance issues
          dataset: DiscoverDatasets.ISSUE_PLATFORM,
          field: ['title', 'project.name', 'timestamp', 'issue.id', 'issue'],
          per_page: 100,
          query: `trace:${traceId}`,
          referrer: 'api.issues.issue_events',
          sort: '-timestamp',
          start,
          end,
        },
      },
    ],
    {staleTime: Infinity, retry: false}
  );
  const {
    data: discoverData,
    isLoading: isLoadingDiscover,
    isError: isErrorDiscover,
  } = useApiQuery<{
    data: TimelineTransactionEvent[];
    meta: unknown;
  }>(
    [
      `/organizations/${organization.slug}/events/`,
      {
        query: {
          // Other events
          dataset: DiscoverDatasets.DISCOVER,
          field: ['title', 'project.name', 'timestamp', 'issue.id', 'issue'],
          per_page: 100,
          query: `trace:${traceId}`,
          referrer: 'api.issues.issue_events',
          sort: '-timestamp',
          start,
          end,
        },
      },
    ],
    {staleTime: Infinity, retry: false}
  );
  const timelineRef = useRef<HTMLDivElement>(null);
  const {width} = useDimensions({elementRef: timelineRef});

  if (isLoadingIssuePlatform || isLoadingDiscover) {
    // TODO: Loading state
    return <div>loading</div>;
  }

  if (isErrorIssuePlatform || isErrorDiscover) {
    return null;
  }

  // Adjusting this will change the number of tooltip groups
  const markerWidth = 20;

  const data: TimelineTransactionEvent[] = [
    ...(issuePlatformData.data ?? []),
    ...(discoverData.data ?? []),
  ];
  const timestamps = data.map(frame => new Date(frame.timestamp).getTime());
  const startTimestamp = Math.min(...timestamps);
  const endTimestamp = Math.max(...timestamps);
  let durationMs = endTimestamp - startTimestamp;
  // Will need to figure out padding
  if (durationMs === 0) {
    durationMs = 1000;
  }

  const totalColumns = Math.floor(width / markerWidth);
  const framesByCol = getFramesByColumn(durationMs, data, totalColumns, startTimestamp);
  const columnSize = width / totalColumns;

  // console.log({
  //   durationMs,
  //   framesByCol,
  //   totalColumns,
  //   width,
  //   markerWidth,
  //   data,
  //   timestamps: [...new Set(timestamps)],
  //   startAndEndTimestampPerColumn,
  // });

  return (
    <VisiblePanel>
      <Stacked ref={timelineRef}>
        <TimelineEventsContainer>
          <Timeline.Columns totalColumns={totalColumns} remainder={0}>
            {Array.from(framesByCol.entries()).map(([column, colFrames]) => {
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
                    colFrames={colFrames}
                    columnSize={columnSize}
                    timerange={[columnStartTimestamp, columnEndTimestamp]}
                    currentEventId={event.id}
                  />
                </EventColumn>
              );
            })}
          </Timeline.Columns>
        </TimelineEventsContainer>
      </Stacked>
    </VisiblePanel>
  );
}

const VisiblePanel = styled(Panel)`
  margin: 0;
  border: 0;
  overflow: hidden;
  background: ${p => p.theme.translucentInnerBorder};
`;

const EventColumn = styled(Timeline.Col)`
  place-items: stretch;
  display: grid;
  align-items: center;
  position: relative;

  &:hover {
    z-index: ${p => p.theme.zIndex.initial};
  }
`;

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
  const framesByCol = getFramesByColumn(
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

const TimelineEventsContainer = styled('div')`
  padding-top: 10px;
  padding-bottom: 10px;
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
