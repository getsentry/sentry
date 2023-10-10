import invariant from 'invariant';

import isValidDate from 'sentry/utils/date/isValidDate';
import type {RawSpanFrame, SpanFrame} from 'sentry/utils/replays/types';
import {isSpanFrame} from 'sentry/utils/replays/types';
import type {ReplayRecord} from 'sentry/views/replays/types';

export default function hydrateSpans(
  replayRecord: ReplayRecord,
  spanFrames: RawSpanFrame[]
): SpanFrame[] {
  const startTimestampMs = replayRecord.started_at.getTime();

  return spanFrames
    .map((frame: RawSpanFrame) => {
      try {
        const start = new Date(frame.startTimestamp * 1000);
        const end = new Date(frame.endTimestamp * 1000);

        invariant(isValidDate(start), 'spanFrame.startTimestamp is invalid');
        invariant(isValidDate(end), 'spanFrame.endTimestamp is invalid');
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
        return undefined;
      }
    })
    .filter(isSpanFrame);
}
