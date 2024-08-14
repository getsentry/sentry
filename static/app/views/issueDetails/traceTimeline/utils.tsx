import type {TimelineEvent} from './useTraceTimelineEvents';

function getEventTimestamp(start: number, event: TimelineEvent) {
  return new Date(event.timestamp).getTime() - start;
}

export function getEventsByColumn(
  events: TimelineEvent[],
  durationMs: number,
  totalColumns: number,
  start: number
): Array<[column: number, events: TimelineEvent[]]> {
  const eventsByColumn = events.reduce((map, event) => {
    const columnPositionCalc =
      Math.floor((getEventTimestamp(start, event) / durationMs) * (totalColumns - 1)) + 1;

    // Should start at minimum in the first column
    const column = Math.max(1, columnPositionCalc);

    if (map.has(column)) {
      map.get(column)!.push(event);
    } else {
      map.set(column, [event]);
    }
    return map;
  }, new Map<number, TimelineEvent[]>());

  return Array.from(eventsByColumn.entries());
}

export function getChunkTimeRange(
  startTimestamp: number,
  chunkIndex: number,
  chunkDurationMs: number
): [number, number] {
  // Calculate the absolute start time of the chunk in milliseconds
  const chunkStartMs = chunkIndex * chunkDurationMs;

  // Add the chunk start time to the overall start timestamp
  const chunkStartTimestamp = startTimestamp + chunkStartMs;

  // Calculate the end timestamp by adding the chunk duration
  const chunkEndTimestamp = chunkStartTimestamp + chunkDurationMs;

  // Round up and down to the nearest second
  return [Math.floor(chunkStartTimestamp), Math.floor(chunkEndTimestamp) + 1];
}
