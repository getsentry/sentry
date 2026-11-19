import {useMemo} from 'react';
import {useTheme, type Theme} from '@emotion/react';
import type {CustomSeriesOption, CustomSeriesRenderItem} from 'echarts';

import {isSevere} from 'sentry/components/charts/annotations/severity';
import type {AnnotationItem} from 'sentry/components/charts/annotations/types';
import {
  BAND_Z,
  type BandBucket,
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

interface AnnotationMarkerItem extends AnnotationBucket {
  value: [start: number, y: number];
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
    if (!defined(x) || x < plot.x || x > plot.x + plot.width) {
      return null;
    }

    const color = theme.tokens.dataviz.semantic.bad;
    return {
      type: 'group',
      children: [
        {
          type: 'line',
          shape: {x1: x, y1: plot.y, x2: x, y2: plot.y + plot.height},
          style: {stroke: color, lineWidth: 1, lineDash: LINE_DASH},
        },
        {
          type: 'circle',
          shape: {cx: x, cy: plot.y, r: CIRCLE_RADIUS},
          style: {fill: color},
        },
      ],
    };
  };
}

interface UseAnnotationMarkersParams {
  buckets: BandBucket[];
  items?: readonly AnnotationItem[];
}

/**
 * A dotted vertical line with a circle on top, drawn over the plot at the
 * center of every chart bucket that has a severe annotation.
 */
export function useAnnotationMarkers({
  buckets,
  items,
}: UseAnnotationMarkersParams): CustomSeriesOption | null {
  const theme = useTheme();

  return useMemo(() => {
    const data: AnnotationMarkerItem[] = bucketAnnotations(
      items?.filter(isSevere) ?? [],
      buckets
    )
      .filter(bucket => bucket.items.length > 0)
      .map(bucket => ({...bucket, value: [bucket.start, 0]}));
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
