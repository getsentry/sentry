import {toEventTimestampMs} from 'sentry/utils/date/eventTimestampMs';
import type {RawReplayError} from 'sentry/utils/replays/types';

export function RawReplayErrorFixture(
  error: Partial<RawReplayError> & {timestamp: Date}
): RawReplayError {
  return {
    'error.type': error['error.type'] ?? [],
    id: error.id ?? 'e123',
    issue: error.issue ?? 'JS-374',
    'issue.id': error['issue.id'] ?? 3740335939,
    'project.name': error['project.name'] ?? 'javascript',
    timestamp_ms: error.timestamp_ms ?? toEventTimestampMs(error.timestamp),
    level: error.level ?? 'Error',
    title: error.title ?? 'A Redirect with :orgId param on customer domain',
  };
}
