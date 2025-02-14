import type {ReleaseMetaBasic} from 'sentry/types/release';
import type {Bucket} from 'sentry/views/dashboards/widgets/timeSeriesWidget/releaseBubbles/types';

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
export function createReleaseBuckets(
  minTime: number | undefined,
  maxTime: number | undefined,
  releases: ReleaseMetaBasic[],
  desiredBuckets = 10
): Bucket[] {
  const buckets: Bucket[] = [];

  if (!minTime || !maxTime) {
    return [];
  }

  // We need to create <desiredBuckets> number of buckets between
  // [minDate, maxDate]. Last bucket always ends at maxDate and does not
  // necessarily have the same bucket width as the other buckets.
  const timeDiff = maxTime - minTime;
  const interval = Math.ceil(timeDiff / desiredBuckets);

  for (let i = 0; i < desiredBuckets; i++) {
    const bucketStartTs = minTime + i * interval;
    // Ending timestamp will clump in the remaining bits if it's not
    // evenly distributed
    const bucketEndTs = i === desiredBuckets - 1 ? maxTime : bucketStartTs + interval;
    buckets.push([bucketStartTs, 0, bucketEndTs, 0, []]);
  }

  // Loop through releases and update its bucket's counters
  for (const release of releases) {
    if (!release) {
      break;
    }

    // We can determine the releaase's bucket location by using its timestamp
    // relative to the series starting timestamp.
    const releaseTs = new Date(release.date).getTime();
    const bucketIndex = Math.floor((releaseTs - minTime) / interval);
    const currentBucket = buckets[bucketIndex];
    const bucketEndTs = currentBucket?.[2];

    // Note we need to check that the release ts is within the ending bounds, solely for
    // the last bucket, as the last buckets width can be less than the
    // others. (i.e. if the total time difference is not perfectly divible by
    // `desiredBuckets`, the last bucket will be the remainder)
    if (bucketEndTs && releaseTs <= bucketEndTs) {
      // Update numReleases
      currentBucket[3] = currentBucket[3] + 1;
      // Update the list of releases
      currentBucket[4].push(release);
    }
  }

  return buckets;
}
