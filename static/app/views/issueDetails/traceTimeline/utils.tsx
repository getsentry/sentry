import type {Organization, User} from 'sentry/types';

import type {TimelineEvent} from './useTraceTimelineEvents';

function getEventTimestamp(start: number, event: TimelineEvent) {
  return new Date(event.timestamp).getTime() - start;
}

export function getEventsByColumn(
  durationMs: number,
  events: TimelineEvent[],
  totalColumns: number,
  start: number
) {
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

  return eventsByColumn;
}

export function hasTraceTimelineFeature(
  organization: Organization | null,
  user: User | undefined
) {
  const newIssueExperienceEnabled = user?.options?.issueDetailsNewExperienceQ42023;
  const hasFeature = organization?.features?.includes('issues-trace-timeline');

  return !!(newIssueExperienceEnabled && hasFeature);
}
