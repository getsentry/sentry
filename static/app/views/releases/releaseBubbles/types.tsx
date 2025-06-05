import type {RawFlag} from 'sentry/components/featureFlags/utils';
import type {ReleaseMetaBasic} from 'sentry/types/release';

export interface Bucket {
  end: number;
  flags: RawFlag[];
  releases: ReleaseMetaBasic[];
  start: number;
  // This is only set on the last bucket item and represents latest timestamp
  // for data whereas `end` represents the point on a chart's x-axis (time).
  // e.g. the max timestamp we show on the x-axis is 3:30, but data at that
  // point represents data from [3:30, now (final)]
  final?: number;
}
