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
import {bucketReleases, type ReleaseBucket} from './bucketReleases';
import type {ChartBand} from './mergeChartBands';
import {ReleaseBandTooltipSection, type BandRelease} from './releaseBandTooltip';

export const RELEASE_BAND_SERIES_ID = '__release_band__';

interface ReleaseBandItem extends ReleaseBucket<BandRelease> {
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
  releases?: readonly BandRelease[];
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

    const bucketsByStart = new Map(releaseBuckets.map(bucket => [bucket.start, bucket]));

    return {
      id: RELEASE_BAND_SERIES_ID,
      buckets: releaseBuckets,
      height: BAND_HEIGHT,
      tooltipSection: start => {
        const bucket = bucketsByStart.get(start);
        return bucket ? <ReleaseBandTooltipSection bucket={bucket} /> : null;
      },
      series: bandOffset => ({
        type: 'custom',
        renderItem: releaseBandRenderItem(data, bandOffset, theme),
        name: RELEASE_BAND_SERIES_ID,
        data,
        color: theme.tokens.graphics.accent.vibrant,
        animation: false,
        legendHoverLink: false,
      }),
    };
  }, [buckets, releases, theme]);
}
