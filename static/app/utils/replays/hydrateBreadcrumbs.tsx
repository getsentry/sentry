import invariant from 'invariant';

import {t} from 'sentry/locale';
import {BreadcrumbType} from 'sentry/types/breadcrumbs';
import isValidDate from 'sentry/utils/date/isValidDate';
import type {
  BreadcrumbFrame,
  RawBreadcrumbFrame,
  RecordingFrame,
} from 'sentry/utils/replays/types';
import {EventType, isBreadcrumbFrame} from 'sentry/utils/replays/types';
import type {ReplayRecord} from 'sentry/views/replays/types';

function findCloseMutations(date: Date, rrwebFrames: RecordingFrame[]) {
  const timeMS = date.getTime();
  const incrementalFrames = rrwebFrames.filter(
    frame => frame.type === EventType.IncrementalSnapshot
  );
  const framesBefore = incrementalFrames.filter(frame => frame.timestamp <= timeMS);
  const framesAfter = incrementalFrames.filter(frame => frame.timestamp > timeMS);
  return {
    prev: framesBefore.slice(-1)[0] ?? null,
    next: framesAfter[0] ?? null,
  };
}

export default function hydrateBreadcrumbs(
  replayRecord: ReplayRecord,
  breadcrumbFrames: RawBreadcrumbFrame[],
  rrwebFrames: RecordingFrame[]
): BreadcrumbFrame[] {
  const startTimestampMs = replayRecord.started_at.getTime();

  return breadcrumbFrames
    .map((frame: RawBreadcrumbFrame) => {
      try {
        const time = new Date(frame.timestamp * 1000);
        invariant(isValidDate(time), 'breadcrumbFrame.timestamp is invalid');

        if (frame.category === 'replay.hydrate-error') {
          frame.data = {
            description: t('Encountered an error while hydrating'),
            mutations: findCloseMutations(time, rrwebFrames),
          };
        }
        return {
          ...frame,
          offsetMs: Math.abs(time.getTime() - startTimestampMs),
          timestamp: time,
          timestampMs: time.getTime(),
        };
      } catch {
        return undefined;
      }
    })
    .filter(isBreadcrumbFrame);
}

export function replayInitBreadcrumb(replayRecord: ReplayRecord): BreadcrumbFrame {
  const initialUrl = replayRecord.urls?.[0] ?? replayRecord.tags.url?.join(', ');

  return {
    category: 'replay.init',
    message: initialUrl,
    offsetMs: 0,
    timestamp: replayRecord.started_at,
    timestampMs: replayRecord.started_at.getTime(),
    type: BreadcrumbType.INIT, // For compatibility reasons. See BreadcrumbType
  };
}
