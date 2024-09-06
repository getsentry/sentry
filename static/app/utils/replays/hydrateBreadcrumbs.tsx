import invariant from 'invariant';

import {t} from 'sentry/locale';
import {BreadcrumbType} from 'sentry/types/breadcrumbs';
import isValidDate from 'sentry/utils/date/isValidDate';
import type {BreadcrumbFrame, RawBreadcrumbFrame} from 'sentry/utils/replays/types';
import {isBreadcrumbFrame} from 'sentry/utils/replays/types';
import type {ReplayRecord} from 'sentry/views/replays/types';

export default function hydrateBreadcrumbs(
  replayRecord: ReplayRecord,
  breadcrumbFrames: RawBreadcrumbFrame[]
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
