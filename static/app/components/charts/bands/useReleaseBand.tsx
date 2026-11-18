import {useMemo} from 'react';
import {useTheme, type Theme} from '@emotion/react';
import type {CustomSeriesRenderItem} from 'echarts';

import {Container} from '@sentry/scraps/layout';

import {t} from 'sentry/locale';

import {
  BAND_HEIGHT,
  bandHoverTarget,
  bandLayout,
  bandRect,
  bandTrack,
  bucketHighlight,
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
import {ChartBandTooltipHeading} from './chartBandTooltip';
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

    const range = clampRange(slot, track);
    children.push(...bucketHighlight(slot, params, theme));
    if (bucket.releases.length > 0) {
      children.push(
        bandRect(range, y, track, theme.tokens.graphics.accent.vibrant, {
          opacity: bucket.opacity,
        })
      );
    }
    children.push(bandHoverTarget(range, y));

    return {type: 'group', children};
  };
}

interface UseReleaseBandParams {
  buckets: BandBucket[];
  releases?: readonly BucketableRelease[];
}

/**
 * A band with a marker for every chart bucket that has releases. Buckets
 * without releases can still be hovered.
 */
export function useReleaseBand({
  buckets,
  releases,
}: UseReleaseBandParams): ChartBand | null {
  const theme = useTheme();

  return useMemo(() => {
    const releaseBuckets = bucketReleases(releases ?? [], buckets);
    const bucketsWithReleases = releaseBuckets.filter(
      bucket => bucket.releases.length > 0
    );
    if (bucketsWithReleases.length === 0) {
      return null;
    }

    const releaseCount = bucketsWithReleases.reduce(
      (count, bucket) => count + bucket.releases.length,
      0
    );
    const averageCount = releaseCount / bucketsWithReleases.length;
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
        return bucket ? (
          <Container as="section">
            <ChartBandTooltipHeading
              label={t('Releases')}
              value={bucket.releases.length}
            />
          </Container>
        ) : null;
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
