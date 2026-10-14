import {toEventTimestampMs} from 'sentry/utils/date/eventTimestampMs';
import type {ErrorFrame, RawReplayError} from 'sentry/utils/replays/types';

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

export function ReplayErrorFrameFixture(
  frame: Partial<Omit<ErrorFrame, 'data' | 'timestamp'>> & {
    timestamp: Date;
    data?: Partial<ErrorFrame['data']>;
  }
): ErrorFrame {
  return {
    category: 'issue',
    data: {
      eventId: frame.data?.eventId ?? 'e123',
      groupId: frame.data?.groupId ?? 3740335939,
      groupShortId: frame.data?.groupShortId ?? 'JS-374',
      label: frame.data?.label ?? '',
      labels: frame.data?.labels ?? [],
      level: frame.data?.level ?? 'error',
      projectSlug: frame.data?.projectSlug ?? 'javascript',
    },
    message: frame.message ?? 'A Redirect with :orgId param on customer domain',
    offsetMs: frame.offsetMs ?? 0,
    timestamp: frame.timestamp,
    timestampMs: frame.timestamp.getTime(),
    type: 'error',
  };
}
