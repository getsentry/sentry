import sortedLastIndex from 'lodash/sortedLastIndex';

import type {BandBucket} from './bandShapes';

export interface BucketableRelease {
  timestamp: string;
}

export interface ReleaseBucket<Release extends BucketableRelease> extends BandBucket {
  releases: Release[];
}

/**
 * Puts each release in the chart bucket it was created in, so release buckets
 * line up with the other bands. `buckets` must be sorted by `start`. Only
 * buckets with releases are returned, and releases outside every bucket are
 * left out.
 */
export function bucketReleases<Release extends BucketableRelease>(
  releases: readonly Release[],
  buckets: readonly BandBucket[]
): Array<ReleaseBucket<Release>> {
  const starts = buckets.map(bucket => bucket.start);
  const releasesByBucket = new Map<number, Release[]>();

  for (const release of releases) {
    const time = new Date(release.timestamp).getTime();
    const index = sortedLastIndex(starts, time) - 1;
    const bucket = buckets[index];
    if (!bucket || time >= bucket.end) {
      continue;
    }

    const releasesInBucket = releasesByBucket.get(index) ?? [];
    releasesInBucket.push(release);
    releasesByBucket.set(index, releasesInBucket);
  }

  return buckets.flatMap((bucket, index) => {
    const releasesInBucket = releasesByBucket.get(index);
    return releasesInBucket ? [{...bucket, releases: releasesInBucket}] : [];
  });
}
