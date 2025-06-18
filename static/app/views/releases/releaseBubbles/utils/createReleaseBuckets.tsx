import type {RawFlag} from 'sentry/components/featureFlags/utils';
import type {ReleaseMetaBasic} from 'sentry/types/release';
import type {Bucket} from 'sentry/views/releases/releaseBubbles/types';

//
// Note: You probably don't want to use this directly, use `useReleaseBubbles`
// instead.
//
// Create `desiredBuckets` number of release buckets using the
// min()/max() of timestamps in all `timeSeries`'s `data`.
//
// The timestamp inclusivity is as follows:
//
// [
//  [inclusive, inclusive],
//  [exclusive, inclusive],
//  ...
//  [exclusive, inclusive],
// ]
//
// where only the first bucket's starting timestamp is inclusive.
//
interface CreateReleaseBucketsParams {
  finalTime: number;
  flags: RawFlag[] | undefined;
  maxTime: number | undefined;
  minTime: number | undefined;
  releases: ReleaseMetaBasic[] | undefined;
  desiredBuckets?: number;
}

export function createReleaseBuckets({
  minTime,
  maxTime,
  finalTime,
  flags,
  releases,
  desiredBuckets = 10,
}: CreateReleaseBucketsParams): Bucket[] {
  const buckets: Bucket[] = [];

  if (!minTime || !maxTime) {
    return [];
  }

  // We need to create <desiredBuckets> number of buckets between
  // [minDate, maxDate]. Last bucket always ends at maxDate and does not
  // necessarily have the same bucket width as the other buckets.
  const timeDiff = maxTime - minTime;

  if (timeDiff <= 0) {
    return [];
  }

  const interval = Math.ceil(timeDiff / desiredBuckets);

  for (let i = 0; i < desiredBuckets; i++) {
    const bucketStartTs = minTime + i * interval;
    // Ending timestamp will clump in the remaining bits if it's not
    // evenly distributed
    const isLastBucket = i === desiredBuckets - 1;
    const bucketEndTs = isLastBucket ? maxTime : bucketStartTs + interval;
    const item: Bucket = {
      start: bucketStartTs,
      end: bucketEndTs,
      releases: [],
      flags: [],
    };

    if (isLastBucket) {
      item.final = finalTime;
    }

    buckets.push(item);
  }

  // Loop through releases and update its bucket's counters
  for (const release of releases ?? []) {
    if (!release) {
      break;
    }

    // We can determine the release's bucket location by using its timestamp
    // relative to the series starting timestamp.
    const releaseTs = new Date(release.date).getTime();
    const bucketIndex = Math.floor((releaseTs - minTime) / interval);
    const currentBucket = buckets[bucketIndex];
    const bucketEndTs = currentBucket?.end;

    // Note that `maxTime` represents the position on the xaxis (time) of the
    // last data point. That timestamp corresponds to data at "timestamp" +
    // "interval", (e.g. if tooltip says 1:00 and interval between points is
    // 30 minutes, the data collected is between 1:00 and 1:30).
    //
    // The release buckets are different because it has a start and end range
    // and for its last bucket, it's ending boundary is `maxTime` to
    // correspond to the chart. We cannot change `maxTime` for the buckets
    // otherwise we will draw bubbles past the chart data and it would look
    // broken.
    //
    // For now we're going to assume that releases will always fall inbounds
    // and stick any releases with timestamp > `maxLife` into the last
    // bucket. The tooltip will be slightly wrong because it will leave out
    // the last interval.
    if (bucketEndTs) {
      currentBucket.releases.push(release);
    } else if (releaseTs > maxTime) {
      // If we couldn't find a bucket, add release to latest bucket
      const lastBucket = buckets.at(-1);
      lastBucket?.releases.push(release);
    }
  }

  for (const flag of flags ?? []) {
    const flagTs = new Date(flag.createdAt).getTime();
    const bucketIndex = Math.floor((flagTs - minTime) / interval);
    const currentBucket = buckets[bucketIndex];
    const bucketEndTs = currentBucket?.end;
    if (bucketEndTs) {
      currentBucket.flags.push(flag);
    } else if (flagTs > maxTime) {
      // If we couldn't find a bucket, add release to latest bucket
      const lastBucket = buckets.at(-1);
      lastBucket?.flags.push(flag);
    }
  }

  return buckets;
}
