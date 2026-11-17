import * as Sentry from '@sentry/react';
import invariant from 'invariant';

import {isValidDate} from 'sentry/utils/date/isValidDate';
import type {HydratedReplayRecord} from 'sentry/views/explore/replays/types';

import type {RawSpanFrame, SpanFrame} from './types';
import {isMemoryFrame, isSpanFrame} from './types';

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

        const hydratedFrame: SpanFrame = {
          ...frame,
          endTimestamp: end,
          endTimestampMs: end.getTime(),
          offsetMs: Math.abs(start.getTime() - startTimestampMs),
          startTimestamp: start,
          timestampMs: start.getTime(),

          // TODO: do we need this added as well?
          // id: `${span.description ?? span.op}-${span.startTimestamp}-${span.endTimestamp}`,
        };
        if (!frame.data || (frame.op === 'memory' && !isMemoryFrame(hydratedFrame))) {
          opsMissingData.add(frame.op);
        }
        return hydratedFrame;
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
