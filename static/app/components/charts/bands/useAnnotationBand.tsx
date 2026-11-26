import {useMemo} from 'react';
import {useTheme, type Theme} from '@emotion/react';
import type {CustomSeriesRenderItem} from 'echarts';
import sortedLastIndex from 'lodash/sortedLastIndex';

import {Stack} from '@sentry/scraps/layout';

import {
  ANNOTATION_KIND_LABELS,
  ANNOTATION_KINDS,
} from 'sentry/components/charts/annotations/kinds';
import type {AnnotationItem} from 'sentry/components/charts/annotations/types';
import {defined} from 'sentry/utils/defined';

import {groupBars} from './annotationBucketSize';
import {
  BAND_HEIGHT,
  bandHoverTarget,
  bandLayout,
  bandPill,
  bucketHighlight,
  bucketSlot,
  clampRange,
  type BandBucket,
  type BandElement,
} from './bandShapes';
import {bucketAnnotations, type AnnotationBucket} from './bucketAnnotations';
import {ChartBandTooltipHeading} from './chartBandTooltip';
import type {ChartBand} from './mergeChartBands';

export const ANNOTATION_BAND_SERIES_ID = '__annotation_band__';

interface AnnotationBandItem extends AnnotationBucket {
  opacity: number;
  value: [start: number, y: number];
}

function markerOpacity(count: number, averageCount: number): number {
  return Math.min(count / averageCount / 2, 1);
}

function annotationBandRenderItem(
  data: AnnotationBandItem[],
  barInterval: number,
  bandOffset: number,
  theme: Theme
): CustomSeriesRenderItem {
  return function renderAnnotationBandItem(params, api) {
    const bucket = data[params.dataIndex];
    if (!bucket) {
      return null;
    }

    const slot = bucketSlot(bucket, api, barInterval);
    const layout = bandLayout(bucket, bandOffset, params, api);
    if (!slot || !layout) {
      return null;
    }

    const {track, y} = layout;
    const range = clampRange(slot, track);
    const children: BandElement[] = [...bucketHighlight(slot, params, theme)];
    if (bucket.items.length > 0) {
      children.push(
        bandPill(range, y, theme.tokens.graphics.accent.vibrant, {
          opacity: bucket.opacity,
        })
      );
    }
    children.push(bandHoverTarget(range, y));

    return {type: 'group', children};
  };
}

function withEarlierRanges(
  annotationBuckets: AnnotationBucket[],
  items: readonly AnnotationItem[]
): AnnotationBucket[] {
  const [firstBucket, ...otherBuckets] = annotationBuckets;
  if (!firstBucket) {
    return annotationBuckets;
  }

  const earlierRanges = items.filter(
    ({start, end}) =>
      start < firstBucket.start &&
      (end === 'ongoing' || (defined(end) && end >= firstBucket.start))
  );
  return earlierRanges.length > 0
    ? [{...firstBucket, items: [...earlierRanges, ...firstBucket.items]}, ...otherBuckets]
    : annotationBuckets;
}

/**
 * The annotations of the bucket holding `hovered` that start within it.
 * Ranges carried in from before the bucket count from the bucket's start.
 */
function itemsInRange(
  annotationBuckets: AnnotationBucket[],
  starts: number[],
  hovered: BandBucket
): AnnotationItem[] | null {
  const bucket = annotationBuckets[sortedLastIndex(starts, hovered.start) - 1];
  if (!bucket || hovered.start >= bucket.end) {
    return null;
  }

  return bucket.items.filter(
    item =>
      item.start < hovered.end &&
      (item.start >= hovered.start || hovered.start === bucket.start)
  );
}

interface UseAnnotationBandParams {
  buckets: BandBucket[];
  barsPerBucket?: number;
  items?: readonly AnnotationItem[];
  onClick?: (items: AnnotationItem[]) => void;
}

/**
 * A band with a pill for every group of `barsPerBucket` bars that has
 * annotations, shaded by how many it has. Groups without annotations can
 * still be hovered.
 */
export function useAnnotationBand({
  buckets,
  barsPerBucket = 1,
  items,
  onClick,
}: UseAnnotationBandParams): ChartBand | null {
  const theme = useTheme();

  return useMemo(() => {
    const annotationBuckets = withEarlierRanges(
      bucketAnnotations(items ?? [], groupBars(buckets, barsPerBucket)),
      items ?? []
    );
    const bucketsWithItems = annotationBuckets.filter(bucket => bucket.items.length > 0);
    if (bucketsWithItems.length === 0) {
      return null;
    }

    const itemCount = bucketsWithItems.reduce(
      (count, bucket) => count + bucket.items.length,
      0
    );
    const averageCount = itemCount / bucketsWithItems.length;
    const data: AnnotationBandItem[] = annotationBuckets.map(bucket => ({
      ...bucket,
      opacity: markerOpacity(bucket.items.length, averageCount),
      value: [bucket.start, 0],
    }));

    const kindsInBand = ANNOTATION_KINDS.filter(kind =>
      bucketsWithItems.some(bucket => bucket.items.some(item => item.kind === kind))
    );
    const starts = annotationBuckets.map(bucket => bucket.start);
    const bucketsByStart = new Map(
      annotationBuckets.map(bucket => [bucket.start, bucket])
    );
    const firstBar = buckets[0];
    const barInterval = firstBar ? firstBar.end - firstBar.start : 0;

    return {
      id: ANNOTATION_BAND_SERIES_ID,
      buckets: annotationBuckets,
      height: BAND_HEIGHT,
      onClick: start => {
        const bucket = bucketsByStart.get(start);
        if (bucket) {
          onClick?.(bucket.items);
        }
      },
      tooltipSection: hovered => {
        const itemsInHovered = itemsInRange(annotationBuckets, starts, hovered);
        return itemsInHovered ? (
          <Stack as="section" gap="md" padding="lg 0">
            {kindsInBand.map(kind => (
              <ChartBandTooltipHeading
                key={kind}
                label={ANNOTATION_KIND_LABELS[kind]}
                value={itemsInHovered.filter(item => item.kind === kind).length}
                padding="0 xl"
              />
            ))}
          </Stack>
        ) : null;
      },
      series: bandOffset => ({
        type: 'custom',
        renderItem: annotationBandRenderItem(data, barInterval, bandOffset, theme),
        name: ANNOTATION_BAND_SERIES_ID,
        data,
        color: theme.tokens.graphics.accent.vibrant,
        animation: false,
        legendHoverLink: false,
      }),
    };
  }, [barsPerBucket, buckets, items, onClick, theme]);
}
