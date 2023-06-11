import {BreadcrumbType} from 'sentry/types/breadcrumbs';
import type {BreadcrumbFrame, RawBreadcrumbFrame} from 'sentry/utils/replays/types';
import type {ReplayRecord} from 'sentry/views/replays/types';

export default function hydrateBreadcrumbs(
  replayRecord: ReplayRecord,
  breadcrumbFrames: RawBreadcrumbFrame[]
): BreadcrumbFrame[] {
  const startTimestampMs = replayRecord.started_at.getTime();

  return breadcrumbFrames.map((frame: RawBreadcrumbFrame) => {
    const time = new Date(frame.timestamp * 1000);
    return {
      ...frame,
      offsetMS: Math.abs(time.getTime() - startTimestampMs),
      timestamp: time,
      timestampMS: time.getTime(),
    };
  });
}

export function replayInitBreadcrumb(replayRecord: ReplayRecord): BreadcrumbFrame {
  const initialUrl = replayRecord.urls?.[0] ?? replayRecord.tags.url?.join(', ');

  return {
    category: 'replay.init',
    message: initialUrl,
    offsetMS: 0,
    timestamp: replayRecord.started_at,
    timestampMS: replayRecord.started_at.getTime(),
    type: BreadcrumbType.INIT, // For compatibility reasons. See BreadcrumbType
  };
}
