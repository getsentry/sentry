import {useMemo} from 'react';
import {useTheme, type Theme} from '@emotion/react';
import type {CustomSeriesOption, CustomSeriesRenderItem} from 'echarts';
import sortedLastIndex from 'lodash/sortedLastIndex';

import {isSevere} from 'sentry/components/charts/annotations/severity';
import type {AnnotationItem} from 'sentry/components/charts/annotations/types';
import {
  BAND_Z,
  type BandBucket,
  type BandElement,
  type CartesianCoordSys,
} from 'sentry/components/charts/bands/bandShapes';
import {
  bucketAnnotations,
  type AnnotationBucket,
} from 'sentry/components/charts/bands/bucketAnnotations';
import {defined} from 'sentry/utils/defined';

const ANNOTATION_MARKERS_SERIES_ID = '__annotation_markers__';

const CIRCLE_RADIUS = 3;
const LINE_DASH = [2, 2];
const RANGE_LINE_WIDTH = 2;

interface AnnotationMarkerItem extends AnnotationBucket {
  value: [start: number, y: number];
  rangeEnd?: number;
}

/**
 * Ranges that are ongoing or end after the last bucket run to the right edge,
 * and ranges that end in the bucket they start in have no end.
 */
function bucketRangeEnd(
  item: AnnotationItem,
  bucket: BandBucket,
  buckets: readonly BandBucket[],
  starts: readonly number[]
): number | undefined {
  const lastBucket = buckets.at(-1);
  if (!defined(item.end) || !lastBucket) {
    return undefined;
  }
  if (item.end === 'ongoing' || item.end >= lastBucket.end) {
    return Infinity;
  }

  const end = buckets[sortedLastIndex(starts, item.end) - 1]?.start;
  return defined(end) && end > bucket.start ? end : undefined;
}

function annotationMarkerRenderItem(
  data: AnnotationMarkerItem[],
  theme: Theme
): CustomSeriesRenderItem {
  return function renderAnnotationMarker(params, api) {
    const bucket = data[params.dataIndex];
    if (!bucket) {
      return null;
    }

    const [x] = api.coord([bucket.start, 0]);
    const plot = params.coordSys as CartesianCoordSys;
    const plotRight = plot.x + plot.width;
    if (!defined(x) || x < plot.x || x > plotRight) {
      return null;
    }

    const color = theme.tokens.dataviz.semantic.bad;
    const children: BandElement[] = [];

    if (defined(bucket.rangeEnd)) {
      const endX = Number.isFinite(bucket.rangeEnd)
        ? api.coord([bucket.rangeEnd, 0])[0]
        : undefined;
      children.push({
        type: 'line',
        shape: {
          x1: x,
          y1: plot.y,
          x2: Math.min(endX ?? plotRight, plotRight),
          y2: plot.y,
        },
        style: {stroke: color, lineWidth: RANGE_LINE_WIDTH},
      });
    }

    children.push(
      {
        type: 'line',
        shape: {x1: x, y1: plot.y, x2: x, y2: plot.y + plot.height},
        style: {stroke: color, lineWidth: 1, lineDash: LINE_DASH},
      },
      {
        type: 'circle',
        shape: {cx: x, cy: plot.y, r: CIRCLE_RADIUS},
        style: {fill: color},
      }
    );

    return {type: 'group', children};
  };
}

interface UseAnnotationMarkersParams {
  buckets: BandBucket[];
  items?: readonly AnnotationItem[];
}

/**
 * A dotted vertical line with a circle on top, drawn over the plot at the
 * center of every chart bucket that has a severe annotation. When a severe
 * annotation covers a range that ends in a later bucket, a solid line runs
 * along the top of the plot to the center of that bucket.
 */
export function useAnnotationMarkers({
  buckets,
  items,
}: UseAnnotationMarkersParams): CustomSeriesOption | null {
  const theme = useTheme();

  return useMemo(() => {
    const starts = buckets.map(bucket => bucket.start);
    const data: AnnotationMarkerItem[] = bucketAnnotations(
      items?.filter(isSevere) ?? [],
      buckets
    )
      .filter(bucket => bucket.items.length > 0)
      .map(bucket => {
        const rangeEnds = bucket.items
          .map(item => bucketRangeEnd(item, bucket, buckets, starts))
          .filter(defined);
        return {
          ...bucket,
          value: [bucket.start, 0],
          rangeEnd: rangeEnds.length > 0 ? Math.max(...rangeEnds) : undefined,
        };
      });
    if (data.length === 0) {
      return null;
    }

    return {
      id: ANNOTATION_MARKERS_SERIES_ID,
      type: 'custom',
      renderItem: annotationMarkerRenderItem(data, theme),
      name: ANNOTATION_MARKERS_SERIES_ID,
      data,
      color: theme.tokens.dataviz.semantic.bad,
      z: BAND_Z - 1,
      clip: false,
      silent: true,
      tooltip: {show: false},
      animation: false,
      legendHoverLink: false,
    };
  }, [buckets, items, theme]);
}
