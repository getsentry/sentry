import * as Sentry from '@sentry/react';
import invariant from 'invariant';
import partition from 'lodash/partition';

import isValidDate from 'sentry/utils/date/isValidDate';
import type {
  BreadcrumbFrame,
  ErrorFrame,
  RawReplayError,
} from 'sentry/utils/replays/types';
import {isErrorFrame, isFeedbackFrame} from 'sentry/utils/replays/types';
import toArray from 'sentry/utils/toArray';
import type {ReplayRecord} from 'sentry/views/replays/types';

export default function hydrateErrors(
  replayRecord: ReplayRecord,
  errors: RawReplayError[]
): {errorFrames: ErrorFrame[]; feedbackFrames: BreadcrumbFrame[]} {
  const startTimestampMs = replayRecord.started_at.getTime();

  const [rawFeedback, rawErrors] = partition(errors, e => e.title === 'User Feedback');

  const errorFrames = rawErrors
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
            labels: toArray(error['error.type']).filter(Boolean),
            projectSlug: error['project.name'],
          },
          message: error.title,
          offsetMs: Math.abs(time.getTime() - startTimestampMs),
          timestamp: time,
          timestampMs: time.getTime(),
          type: 'error', // For compatibility reasons. See BreadcrumbType
        };
      } catch (err) {
        Sentry.captureException(err);
        return undefined;
      }
    })
    .filter(isErrorFrame);

  const feedbackFrames = rawFeedback
    .map(feedback => {
      try {
        const time = new Date(feedback.timestamp);
        invariant(isValidDate(time), 'feedbackFrame.timestamp is invalid');

        return {
          category: 'feedback',
          data: {
            eventId: feedback.id,
            groupId: feedback['issue.id'],
            groupShortId: feedback.issue,
            label:
              (Array.isArray(feedback['error.type'])
                ? feedback['error.type'][0]
                : feedback['error.type']) ?? '',
            labels: toArray(feedback['error.type']).filter(Boolean),
            projectSlug: feedback['project.name'],
          },
          message: feedback.title,
          offsetMs: Math.abs(time.getTime() - startTimestampMs),
          timestamp: time,
          timestampMs: time.getTime(),
          type: 'user', // For compatibility reasons. See BreadcrumbType
        };
      } catch (err) {
        Sentry.captureException(err);
        return undefined;
      }
    })
    .filter(isFeedbackFrame);

  return {errorFrames, feedbackFrames};
}
