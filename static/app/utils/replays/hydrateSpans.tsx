import * as Sentry from '@sentry/react';
import invariant from 'invariant';

import {isValidDate} from 'sentry/utils/date/isValidDate';
import type {RawSpanFrame, SpanFrame} from 'sentry/utils/replays/types';
import {isSpanFrame} from 'sentry/utils/replays/types';
import type {HydratedReplayRecord} from 'sentry/views/explore/replays/types';

export function hydrateSpans(
  replayRecord: HydratedReplayRecord,
  spanFrames: RawSpanFrame[]
): SpanFrame[] {
  const startTimestampMs = replayRecord.started_at.getTime();
  const opsMissingData = new Set<string>();

  const hydrated = spanFrames
    .map((frame: RawSpanFrame) => {
      try {
        const start = new Date(frame.startTimestamp * 1000);
        const end = new Date(frame.endTimestamp * 1000);

        invariant(isValidDate(start), 'spanFrame.startTimestamp is invalid');
        invariant(isValidDate(end), 'spanFrame.endTimestamp is invalid');

        if (!frame.data) {
          opsMissingData.add(frame.op);
        }
        return {
          ...frame,
          endTimestamp: end,
          endTimestampMs: end.getTime(),
          offsetMs: Math.abs(start.getTime() - startTimestampMs),
          startTimestamp: start,
          timestampMs: start.getTime(),

          // TODO: do we need this added as well?
          // id: `${span.description ?? span.op}-${span.startTimestamp}-${span.endTimestamp}`,
        };
      } catch {
        return;
      }
    })
    .filter(isSpanFrame);

  if (opsMissingData.size > 0) {
    Sentry.logger.warn('Replay: span frames are missing data', {
      ops: [...opsMissingData].sort().join(','),
      sdk_name: replayRecord.sdk.name,
      sdk_version: replayRecord.sdk.version,
    });
  }

  return hydrated;
}
