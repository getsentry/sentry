import {useRef} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import Panel from 'sentry/components/panels/panel';
import BreadcrumbItem from 'sentry/components/replays/breadcrumbs/breadcrumbItem';
import Stacked from 'sentry/components/replays/breadcrumbs/stacked';
import * as Timeline from 'sentry/components/replays/breadcrumbs/timeline';
import {Tooltip} from 'sentry/components/tooltip';
import {Event} from 'sentry/types';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {getTraceTimeRangeFromEvent} from 'sentry/utils/performance/quickTrace/utils';
import {useApiQuery} from 'sentry/utils/queryClient';
import getFrameDetails from 'sentry/utils/replays/getFrameDetails';
import useActiveReplayTab from 'sentry/utils/replays/hooks/useActiveReplayTab';
import useCrumbHandlers from 'sentry/utils/replays/hooks/useCrumbHandlers';
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

interface TraceTimelineProps {
  event: Event;
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

  const columnFramePairs = frames.map(frame => {
    const columnPositionCalc =
      Math.floor(
        (getEventTimestamp(start, frame) / safeDurationMs) * (totalColumns - 1)
      ) + 1;

    // Should start at minimum in the first column
    const column = Math.max(1, columnPositionCalc);

    return [column, frame] as [number, TimelineTransactionEvent];
  });

  const framesByColumn = columnFramePairs.reduce<Map<number, TimelineTransactionEvent[]>>(
    (map, [column, frame]) => {
      if (map.has(column)) {
        map.get(column)?.push(frame);
      } else {
        map.set(column, [frame]);
      }
      return map;
    },
    new Map()
  );

  return framesByColumn;
}

export function TraceTimeline({event}: TraceTimelineProps) {
  const {start, end} = getTraceTimeRangeFromEvent(event);
  const traceId = event.contexts?.trace?.trace_id ?? '';

  const organization = useOrganization();
  const {data, isLoading, isError} = useApiQuery<{
    data: TimelineTransactionEvent[];
    meta: unknown;
  }>(
    [
      `/organizations/${organization.slug}/events/`,
      {
        query: {
          dataset: DiscoverDatasets.ISSUE_PLATFORM,
          field: ['title', 'project.name', 'timestamp', 'issue.id', 'issue'],
          per_page: 50,
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

  if (isLoading) {
    // TODO: Loading state
    return <div>I love loading</div>;
  }

  if (isError) {
    return null;
  }

  const markerWidth = 12;

  const timestamps = data.data.map(frame => new Date(frame.timestamp).getTime());
  const startTimestamp = Math.min(...timestamps);
  const endTimestamp = Math.max(...timestamps);
  const durationMs = endTimestamp - startTimestamp;
  console.log({startTimestamp, endTimestamp, durationMs});
  const totalColumns = Math.floor(width / markerWidth);
  const framesByCol = getFramesByColumn(
    durationMs,
    data.data,
    totalColumns,
    startTimestamp
  );
  console.log({
    framesByCol,
    totalColumns,
    width,
    markerWidth,
  });

  return (
    <VisiblePanel>
      <Stacked ref={timelineRef}>
        <TimelineEventsContainer>
          <Timeline.Columns totalColumns={totalColumns} remainder={0}>
            {Array.from(framesByCol.entries()).map(([column, colFrames]) => (
              <EventColumn key={column} column={column}>
                <Thing markerWidth={markerWidth} colFrames={colFrames} />
              </EventColumn>
            ))}
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

const EventColumn = styled(Timeline.Col)<{column: number}>`
  grid-column: ${p => Math.floor(p.column)};
  place-items: stretch;
  display: grid;
  align-items: center;
  position: relative;

  &:hover {
    z-index: ${p => p.theme.zIndex.initial};
  }
`;

function Thing({
  markerWidth,
  colFrames,
}: {
  colFrames: TimelineTransactionEvent[];
  markerWidth: number;
}) {
  return (
    <IconPosition style={{marginLeft: `${markerWidth / 2}px`}}>
      <Tooltip title={colFrames[0]!.title} isHoverable skipWrapper>
        <IconNode />
      </Tooltip>
    </IconPosition>
  );
}

const TimelineEventsContainer = styled('div')`
  padding-top: 10px;
  padding-bottom: 10px;
`;

const IconPosition = styled('div')`
  position: absolute;
  transform: translate(-50%);
`;

const IconNode = styled('div')`
  grid-column: 1;
  grid-row: 1;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  color: ${p => p.theme.white};
  box-shadow: ${p => p.theme.dropShadowLight};
  user-select: none;
  background-color: red;
`;
