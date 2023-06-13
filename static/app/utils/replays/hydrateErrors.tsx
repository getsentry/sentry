import {BreadcrumbType} from 'sentry/types/breadcrumbs';
import type {ErrorFrame, RawReplayError} from 'sentry/utils/replays/types';
import type {ReplayRecord} from 'sentry/views/replays/types';

export default function hydrateErrors(
  replayRecord: ReplayRecord,
  errors: RawReplayError[]
): ErrorFrame[] {
  const startTimestampMs = replayRecord.started_at.getTime();

  return errors.map(error => {
    const time = new Date(error.timestamp);
    return {
      category: 'issue',
      data: {
        eventId: error.id,
        groupId: error['issue.id'],
        groupShortId: error.issue,
        label:
          (Array.isArray(error['error.type'])
            ? error['error.type'][0]
            : error['error.type']) ?? '',
        projectSlug: error['project.name'],
      },
      message: error.title,
      offsetMs: Math.abs(time.getTime() - startTimestampMs),
      timestamp: time,
      timestampMs: time.getTime(),
      type: BreadcrumbType.ERROR, // For compatibility reasons. See BreadcrumbType
    };
  });
}
