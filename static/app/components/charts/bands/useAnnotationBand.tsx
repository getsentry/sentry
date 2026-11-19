import {useMemo} from 'react';
import {useTheme, type Theme} from '@emotion/react';
import type {CustomSeriesRenderItem} from 'echarts';

import {Container} from '@sentry/scraps/layout';

import type {
  AnnotationItem,
  AnnotationKind,
} from 'sentry/components/charts/annotations/types';
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
import {bucketAnnotations, type AnnotationBucket} from './bucketAnnotations';
import {ChartBandTooltipHeading} from './chartBandTooltip';
import type {ChartBand} from './mergeChartBands';

export const ANNOTATION_BAND_SERIES_ID = '__annotation_band__';

const ANNOTATION_KINDS: AnnotationKind[] = ['release', 'flag', 'timeseriesAnnotation'];

const ANNOTATION_KIND_LABELS: Record<AnnotationKind, string> = {
  release: t('Releases'),
  flag: t('Flags'),
  timeseriesAnnotation: t('Changes'),
};

interface AnnotationBandItem extends AnnotationBucket {
  opacity: number;
  value: [start: number, y: number];
}

function markerOpacity(count: number, averageCount: number): number {
  return Math.min(count / averageCount / 2, 1);
}

function annotationBandRenderItem(
  data: AnnotationBandItem[],
  bandOffset: number,
  theme: Theme
): CustomSeriesRenderItem {
  return function renderAnnotationBandItem(params, api) {
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
    if (bucket.items.length > 0) {
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

interface UseAnnotationBandParams {
  buckets: BandBucket[];
  items?: readonly AnnotationItem[];
}

/**
 * A band with a marker for every chart bucket that has annotations, shaded by
 * how many it has. Buckets without annotations can still be hovered.
 */
export function useAnnotationBand({
  buckets,
  items,
}: UseAnnotationBandParams): ChartBand | null {
  const theme = useTheme();

  return useMemo(() => {
    const annotationBuckets = bucketAnnotations(items ?? [], buckets);
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
    const bucketsByStart = new Map(
      annotationBuckets.map(bucket => [bucket.start, bucket])
    );

    return {
      id: ANNOTATION_BAND_SERIES_ID,
      buckets: annotationBuckets,
      height: BAND_HEIGHT,
      tooltipSection: start => {
        const bucket = bucketsByStart.get(start);
        return bucket ? (
          <Container as="section">
            {kindsInBand.map(kind => (
              <ChartBandTooltipHeading
                key={kind}
                label={ANNOTATION_KIND_LABELS[kind]}
                value={bucket.items.filter(item => item.kind === kind).length}
              />
            ))}
          </Container>
        ) : null;
      },
      series: bandOffset => ({
        type: 'custom',
        renderItem: annotationBandRenderItem(data, bandOffset, theme),
        name: ANNOTATION_BAND_SERIES_ID,
        data,
        color: theme.tokens.graphics.accent.vibrant,
        animation: false,
        legendHoverLink: false,
      }),
    };
  }, [buckets, items, theme]);
}
