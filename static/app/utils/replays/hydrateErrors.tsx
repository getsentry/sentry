import * as Sentry from '@sentry/react';
import invariant from 'invariant';

import {defined} from 'sentry/utils';
import toArray from 'sentry/utils/array/toArray';
import isValidDate from 'sentry/utils/date/isValidDate';
import type {
  BreadcrumbFrame,
  ErrorFrame,
  RawReplayError,
} from 'sentry/utils/replays/types';
import type {ReplayRecord} from 'sentry/views/replays/types';

export default function hydrateErrors(
  replayRecord: ReplayRecord,
  errors: RawReplayError[]
): {errorFrames: ErrorFrame[]; feedbackFrames: BreadcrumbFrame[]} {
  const startTimestampMs = replayRecord.started_at.getTime();

  const errorFrames: ErrorFrame[] = [];
  const feedbackFrames: BreadcrumbFrame[] = [];

  errors.forEach((e: RawReplayError) => {
    try {
      // Feedback frame
      if (e.title === 'User Feedback') {
        const time = new Date(e.timestamp);
        invariant(isValidDate(time), 'feedbackFrame.timestamp is invalid');

        feedbackFrames.push({
          category: 'feedback',
          data: {
            eventId: e.id,
            groupId: e['issue.id'],
            groupShortId: e.issue,
            label:
              (Array.isArray(e['error.type']) ? e['error.type'][0] : e['error.type']) ??
              '',
            labels: toArray(e['error.type']).filter(Boolean),
            projectSlug: e['project.name'],
          },
          message: e.title,
          offsetMs: Math.abs(time.getTime() - startTimestampMs),
          timestamp: time,
          timestampMs: time.getTime(),
          type: 'user', // For compatibility reasons. See BreadcrumbType
        });
        return;
      }
      // Error frame
      const time = new Date(e.timestamp);
      invariant(isValidDate(time), 'errorFrame.timestamp is invalid');

      errorFrames.push({
        category: 'issue' as const,
        data: {
          eventId: e.id,
          groupId: e['issue.id'],
          groupShortId: e.issue,
          label:
            (Array.isArray(e['error.type']) ? e['error.type'][0] : e['error.type']) ?? '',
          labels: toArray(e['error.type']).filter(defined),
          projectSlug: e['project.name'],
        },
        message: e.title,
        offsetMs: Math.abs(time.getTime() - startTimestampMs),
        timestamp: time,
        timestampMs: time.getTime(),
        type: 'error', // For compatibility reasons. See BreadcrumbType
      });
    } catch (error) {
      Sentry.captureException(error);
    }
  });

  return {errorFrames, feedbackFrames};
}
