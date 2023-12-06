import invariant from 'invariant';

import isValidDate from 'sentry/utils/date/isValidDate';
import type {ErrorFrame, RawReplayError} from 'sentry/utils/replays/types';
import {isErrorFrame} from 'sentry/utils/replays/types';
import type {ReplayRecord} from 'sentry/views/replays/types';

export default function hydrateErrors(
  replayRecord: ReplayRecord,
  errors: RawReplayError[]
): ErrorFrame[] {
  const startTimestampMs = replayRecord.started_at.getTime();

  return errors
    .map(error => {
      try {
        const time = new Date(error.timestamp);
        invariant(isValidDate(time), 'errorFrame.timestamp is invalid');

        return {
          category: 'issue' as const,
          data: {
            eventId: error.id,
            groupId: error['issue.id'],
            groupShortId: error.issue,
            label:
              (Array.isArray(error['error.type'])
                ? error['error.type'][0]
                : error['error.type']) ?? '',
            labels: error['error.type'].filter(Boolean),
            projectSlug: error['project.name'],
          },
          message: error.title,
          offsetMs: Math.abs(time.getTime() - startTimestampMs),
          timestamp: time,
          timestampMs: time.getTime(),
          type: 'error', // For compatibility reasons. See BreadcrumbType
        };
      } catch {
        return undefined;
      }
    })
    .filter(isErrorFrame);
}
