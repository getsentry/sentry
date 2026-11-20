import {useMemo} from 'react';
import {useTheme, type Theme} from '@emotion/react';
import type {CustomSeriesOption, CustomSeriesRenderItem} from 'echarts';
import sortedLastIndex from 'lodash/sortedLastIndex';

import {useTimezone} from '@sentry/scraps/dateTime';
import {useRenderToString} from '@sentry/scraps/renderToString';

import {isSevere} from 'sentry/components/charts/annotations/severity';
import type {AnnotationItem} from 'sentry/components/charts/annotations/types';
import {
  BAND_Z,
  type BandBucket,
  type BandElement,
  type CartesianCoordSys,
} from 'sentry/components/charts/bands/bandShapes';
import {itemTooltipBelowAnchor} from 'sentry/components/charts/bands/bandTooltip';
import {
  bucketAnnotations,
  type AnnotationBucket,
} from 'sentry/components/charts/bands/bucketAnnotations';
import type {ReactEchartsRef} from 'sentry/types/echarts';
import {defined} from 'sentry/utils/defined';

import {AnnotationMarkerTooltip} from './annotationMarkerTooltip';

const ANNOTATION_MARKERS_SERIES_ID = '__annotation_markers__';

const CIRCLE_RADIUS = 3;
const HOVERED_CIRCLE_RADIUS = 5;
const LINE_DASH = [2, 2];
const LINE_HOVER_WIDTH = 9;
const RANGE_LINE_WIDTH = 2;

interface AnnotationMarkerItem extends AnnotationBucket {
  startsBeforeWindow: boolean;
  value: [start: number, y: number];
  rangeEnd?: number;
}

/**
 * Ranges that are ongoing or end after the last bucket run to the right edge,
 * and ranges that end at or before `lineStart` have no end.
 */
function bucketRangeEnd(
  item: AnnotationItem,
  lineStart: number,
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
  return defined(end) && end > lineStart ? end : undefined;
}

/**
 * Markers for ranges that started before the first bucket have no circle or
 * vertical line, and their range line starts at the left edge of the plot.
 */
function toMarker(
  bucket: AnnotationBucket,
  buckets: readonly BandBucket[],
  starts: readonly number[],
  startsBeforeWindow = false
): AnnotationMarkerItem {
  const lineStart = startsBeforeWindow ? -Infinity : bucket.start;
  const rangeEnds = bucket.items
    .map(item => bucketRangeEnd(item, lineStart, buckets, starts))
    .filter(defined);

  return {
    ...bucket,
    startsBeforeWindow,
    value: [bucket.start, 0],
    rangeEnd: rangeEnds.length > 0 ? Math.max(...rangeEnds) : undefined,
  };
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

    const plot = params.coordSys as CartesianCoordSys;
    const plotRight = plot.x + plot.width;
    const x = bucket.startsBeforeWindow ? plot.x : api.coord([bucket.start, 0])[0];
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

    if (!bucket.startsBeforeWindow) {
      children.push(
        {
          type: 'line',
          shape: {x1: x, y1: plot.y, x2: x, y2: plot.y + plot.height},
          style: {stroke: color, lineWidth: 1, lineDash: LINE_DASH},
          emphasis: {style: {lineDash: 'solid'}},
        },
        {
          type: 'circle',
          shape: {cx: x, cy: plot.y, r: CIRCLE_RADIUS},
          style: {fill: color},
          emphasis: {
            style: {
              stroke: color,
              lineWidth: (HOVERED_CIRCLE_RADIUS - CIRCLE_RADIUS) * 2,
            },
          },
        },
        {
          type: 'rect',
          shape: {
            x: x - LINE_HOVER_WIDTH / 2,
            y: plot.y,
            width: LINE_HOVER_WIDTH,
            height: plot.height,
          },
          style: {fill: 'transparent'},
        }
      );
    }

    return {type: 'group', children};
  };
}

interface UseAnnotationMarkersParams {
  buckets: BandBucket[];
  chartRef: React.RefObject<ReactEchartsRef | null>;
  items?: readonly AnnotationItem[];
  utc?: boolean | null;
}

/**
 * A dotted vertical line with a circle on top, drawn over the plot at the
 * center of every chart bucket that has a severe annotation. When a severe
 * annotation covers a range that ends in a later bucket, a solid line runs
 * along the top of the plot to the center of that bucket. Ranges that started
 * before the first bucket only get that line, from the left edge. Hovering a
 * marker turns its dotted line solid, grows its circle, and opens a tooltip
 * under the pointer.
 */
export function useAnnotationMarkers({
  buckets,
  chartRef,
  items,
  utc,
}: UseAnnotationMarkersParams): CustomSeriesOption | null {
  const theme = useTheme();
  const renderToString = useRenderToString();
  const userTimezone = useTimezone();
  const timezone = utc ? 'UTC' : userTimezone;

  return useMemo(() => {
    const starts = buckets.map(bucket => bucket.start);
    const severeItems = items?.filter(isSevere) ?? [];
    const firstBucket = buckets[0];
    const earlierRanges = firstBucket
      ? severeItems.filter(
          item =>
            item.start < firstBucket.start &&
            defined(bucketRangeEnd(item, -Infinity, buckets, starts))
        )
      : [];

    const data: AnnotationMarkerItem[] = bucketAnnotations(severeItems, buckets)
      .filter(bucket => bucket.items.length > 0)
      .map(bucket => toMarker(bucket, buckets, starts));
    if (firstBucket && earlierRanges.length > 0) {
      data.unshift(
        toMarker({...firstBucket, items: earlierRanges}, buckets, starts, true)
      );
    }
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
      tooltip: itemTooltipBelowAnchor(
        chartRef,
        point => ({x: point[0], bottom: point[1]}),
        dataIndex => {
          const marker = data[dataIndex];
          return marker
            ? renderToString(
                <AnnotationMarkerTooltip items={marker.items} timezone={timezone} />
              )
            : '';
        }
      ),
      animation: false,
      legendHoverLink: false,
    };
  }, [buckets, chartRef, items, renderToString, theme, timezone]);
}
