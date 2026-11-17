import {useMemo} from 'react';
import {useTheme, type Theme} from '@emotion/react';
import type {CustomSeriesRenderItem} from 'echarts';

import {
  BAND_HEIGHT,
  bandLayout,
  bandRect,
  bandTrack,
  bucketSlot,
  clampRange,
  type BandBucket,
  type BandElement,
} from './bandShapes';
import {
  bucketReleases,
  type BucketableRelease,
  type ReleaseBucket,
} from './bucketReleases';
import type {ChartBand} from './mergeChartBands';

export const RELEASE_BAND_SERIES_ID = '__release_band__';

interface ReleaseBandItem extends ReleaseBucket<BucketableRelease> {
  opacity: number;
  value: [start: number, y: number];
}

function releaseOpacity(count: number, averageCount: number): number {
  return Math.min(count / averageCount / 2, 1);
}

function releaseBandRenderItem(
  data: ReleaseBandItem[],
  bandOffset: number,
  theme: Theme
): CustomSeriesRenderItem {
  return function renderReleaseBandItem(params, api) {
    const bucket = data[params.dataIndex];
    if (!bucket) {
      return null;
    }

    const slot = bucketSlot(bucket, api);
    const layout = bandLayout(bucket, bandOffset, params, api);
    if (!slot || !layout) {
      return null;
    }

    const {track, y} = layout;
    const children: BandElement[] = [];

    if (params.dataIndexInside === 0) {
      children.push(bandTrack(track, y, theme));
    }

    children.push(
      bandRect(clampRange(slot, track), y, track, theme.tokens.graphics.accent.vibrant, {
        opacity: bucket.opacity,
      })
    );

    return {type: 'group', children};
  };
}

interface UseReleaseBandParams {
  buckets: BandBucket[];
  releases?: readonly BucketableRelease[];
}

/**
 * A band with a marker for every chart bucket that has releases.
 */
export function useReleaseBand({
  buckets,
  releases,
}: UseReleaseBandParams): ChartBand | null {
  const theme = useTheme();

  return useMemo(() => {
    const releaseBuckets = bucketReleases(releases ?? [], buckets);
    if (releaseBuckets.length === 0) {
      return null;
    }

    const releaseCount = releaseBuckets.reduce(
      (count, bucket) => count + bucket.releases.length,
      0
    );
    const averageCount = releaseCount / releaseBuckets.length;
    const data: ReleaseBandItem[] = releaseBuckets.map(bucket => ({
      ...bucket,
      opacity: releaseOpacity(bucket.releases.length, averageCount),
      value: [bucket.start, 0],
    }));

    return {
      id: RELEASE_BAND_SERIES_ID,
      buckets: releaseBuckets,
      height: BAND_HEIGHT,
      series: bandOffset => ({
        type: 'custom',
        renderItem: releaseBandRenderItem(data, bandOffset, theme),
        name: RELEASE_BAND_SERIES_ID,
        data,
        color: theme.tokens.graphics.accent.vibrant,
        animation: false,
        legendHoverLink: false,
        tooltip: {show: false},
      }),
    };
  }, [buckets, releases, theme]);
}
