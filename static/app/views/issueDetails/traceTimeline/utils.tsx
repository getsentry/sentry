import type {Organization, User} from 'sentry/types';

import type {TimelineEvent} from './useTraceTimelineEvents';

function getEventTimestamp(start: number, event: TimelineEvent) {
  return new Date(event.timestamp).getTime() - start;
}

export function getEventsByColumn(
  durationMs: number,
  frames: TimelineEvent[],
  totalColumns: number,
  start: number
) {
  const safeDurationMs = isNaN(durationMs) ? 1 : durationMs;

  const columnFramePairs = frames.map<[number, TimelineEvent]>(frame => {
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
  }, new Map<number, TimelineEvent[]>());

  return framesByColumn;
}

export function hasTraceTimelineFeature(
  organization: Organization | null,
  user: User | undefined
) {
  const newIssueExperienceEnabled = user?.options?.issueDetailsNewExperienceQ42023;
  const hasFeature = organization?.features?.includes('issues-trace-timeline');

  return !!(newIssueExperienceEnabled && hasFeature);
}
