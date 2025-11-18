import type {OurLogsPseudoFrame} from 'sentry/utils/replays/types';
import {
  OurLogKnownFieldKey,
  type OurLogsResponseItem,
} from 'sentry/views/explore/logs/types';

export function ourlogsAsFrames(
  relativeTimestampMs: number,
  ourlogs: OurLogsResponseItem[]
): OurLogsPseudoFrame[] {
  return ourlogs.map(ourlog => ({
    category: 'ourlogs',
    data: undefined,
    offsetMs:
      new Date(ourlog[OurLogKnownFieldKey.TIMESTAMP]).getTime() - relativeTimestampMs,
    timestampMs: new Date(ourlog[OurLogKnownFieldKey.TIMESTAMP]).getTime(),
  }));
}
