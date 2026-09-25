import {useCallback, useMemo} from 'react';
import {useTheme, type Theme} from '@emotion/react';
import type {
  CustomSeriesOption,
  CustomSeriesRenderItem,
  CustomSeriesRenderItemAPI,
  CustomSeriesRenderItemParams,
  CustomSeriesRenderItemReturn,
  LinearGradientObject,
} from 'echarts';
import type {TooltipPositionCallback} from 'echarts/types/dist/shared';

import {useTimezone} from '@sentry/scraps/datetime';
import {useRenderToString} from '@sentry/scraps/renderToString';

import {isChartHovered} from 'sentry/components/charts/utils';
import {DroppedDataTooltip} from 'sentry/components/droppedData/droppedDataTooltip';
import type {DroppedDataProps} from 'sentry/components/droppedData/types';
import {
  groupIntoBuckets,
  opacityForRatio,
  type AnnotationBucket,
} from 'sentry/components/droppedData/utils';
import type {ReactEchartsRef} from 'sentry/types/echarts';
import {defined} from 'sentry/utils/defined';

export const DROPPED_DATA_SERIES_ID = '__dropped_data__';

// Styling constants
const BAND_PADDING = 4;
const BOX_HEIGHT = 4;
export const BAND_HEIGHT = BAND_PADDING + BOX_HEIGHT + BAND_PADDING;
const BOX_BORDER_RADIUS = 2;
const TOOLTIP_GAP = 8;
const TRACK_OPACITY = 0.1;
// Fraction of each bucket, per side, spent blending into an adjacent bucket.
// 0 gives hard steps; 0.5 blends across the whole bucket.
const BLEND_WIDTH = 0.1;
// Exponent on the drop ratio before it becomes opacity. Lower values make
// differences between small drop rates stand out more; 1 is linear.
const OPACITY_CURVE = 0.6;

const DROPPED_DATA_Y_AXIS = {
  type: 'value' as const,
  min: 0,
  max: 100,
  show: false,
  axisLabel: {show: false},
  axisPointer: {show: false},
};

interface DroppedDataItem extends AnnotationBucket {
  value: [start: number, y: number];
}

interface DroppedDataSeriesParams {
  bandOffset: number;
  buckets: AnnotationBucket[];
  chartRef: React.RefObject<ReactEchartsRef | null>;
  renderTooltip: (bucket: AnnotationBucket) => string;
  theme: Theme;
  yAxisIndex?: number;
}

type BandGroup = Extract<NonNullable<CustomSeriesRenderItemReturn>, {type: 'group'}>;
type BandElement = BandGroup['children'][number];

type CartesianCoordSys = CustomSeriesRenderItemParams['coordSys'] & {
  width: number;
  x: number;
};

interface Span {
  left: number;
  right: number;
}

function clampSpan({left, right}: Span, track: Span): Span {
  return {
    left: Math.min(Math.max(left, track.left), track.right),
    right: Math.min(Math.max(right, track.left), track.right),
  };
}

/**
 * Pixel extent of a bucket. Centred on the bucket start to line up with bar
 * series, and rounded so neighbouring buckets meet without anti-aliased seams.
 */
function bucketSpan(
  bucket: AnnotationBucket,
  api: CustomSeriesRenderItemAPI
): Span | null {
  const [startX] = api.coord([bucket.start, 0]);
  const [endX] = api.coord([bucket.end, 0]);

  if (!defined(startX) || !defined(endX)) {
    return null;
  }

  const halfSlot = (endX - startX) / 2;
  return {left: Math.round(startX - halfSlot), right: Math.round(endX - halfSlot)};
}

/**
 * Rounds only the corners that sit on the ends of the track, so segments
 * inside the band read as one continuous line.
 */
function bandRect(
  span: Span,
  y: number,
  track: Span,
  style: {fill: string | LinearGradientObject; opacity?: number},
  z2 = 0
): BandElement {
  const left = span.left <= track.left ? BOX_BORDER_RADIUS : 0;
  const right = span.right >= track.right ? BOX_BORDER_RADIUS : 0;

  return {
    type: 'rect',
    silent: true,
    z2,
    shape: {
      x: span.left,
      y,
      width: span.right - span.left,
      height: BOX_HEIGHT,
      r: [left, right, right, left],
    },
    style,
  };
}

/**
 * Canvas gradients interpolate without premultiplying alpha, so blending
 * through `transparent` (transparent black) would darken midway. Theme tokens
 * are `#RRGGBB[AA]`, so rewriting the alpha keeps the hue.
 */
function withAlpha(color: string, alpha: number): string {
  const hexAlpha = Math.round(alpha * 255)
    .toString(16)
    .padStart(2, '0');
  return `${color.slice(0, 7)}${hexAlpha}`;
}

/**
 * Left-to-right gradient through alphas of a single color.
 */
function alphaGradient(
  color: string,
  stops: Array<{alpha: number; offset: number}>
): LinearGradientObject {
  return {
    type: 'linear',
    x: 0,
    y: 0,
    x2: 1,
    y2: 0,
    colorStops: stops.map(({offset, alpha}) => ({
      offset,
      color: withAlpha(color, alpha),
    })),
  };
}

/**
 * One bucket of the band. The first rendered bucket also draws the track
 * across the plot area. Buckets without a dropped neighbour fade into the
 * empty slot beside them, stopping halfway when another run is close so the
 * two fades meet instead of overlapping.
 */
function droppedDataRenderItem(
  data: DroppedDataItem[],
  bandOffset: number,
  theme: Theme
): CustomSeriesRenderItem {
  const color = theme.tokens.dataviz.semantic.bad;

  return function renderDroppedDataItem(params, api) {
    const bucket = data[params.dataIndex];
    const span = bucket ? bucketSpan(bucket, api) : null;
    const [, baseY] = bucket ? api.coord([bucket.start, 0]) : [];

    if (!bucket || !span || !defined(baseY)) {
      return null;
    }

    const {x, width} = params.coordSys as CartesianCoordSys;
    const track = {left: x, right: x + width};
    const bandTop = baseY + bandOffset;
    const y = bandTop + BAND_PADDING;
    const slotWidth = span.right - span.left;
    const opacity = opacityForRatio(bucket.ratio, OPACITY_CURVE);

    const prev = data[params.dataIndex - 1];
    const next = data[params.dataIndex + 1];
    const prevIsAdjacent = prev?.end === bucket.start;
    const nextIsAdjacent = next?.start === bucket.end;

    const children: BandElement[] = [];

    if (params.dataIndexInside === 0) {
      children.push(bandRect(track, y, track, {fill: color, opacity: TRACK_OPACITY}, -1));
    }

    // Edges meet an adjacent bucket at the average of both opacities, so a
    // run blends from one bucket into the next instead of stepping, while
    // the middle of each bucket holds its own opacity.
    const segment = clampSpan(span, track);
    const leftAlpha =
      prev && prevIsAdjacent
        ? (opacityForRatio(prev.ratio, OPACITY_CURVE) + opacity) / 2
        : opacity;
    const rightAlpha =
      next && nextIsAdjacent
        ? (opacity + opacityForRatio(next.ratio, OPACITY_CURVE)) / 2
        : opacity;
    children.push(
      bandRect(segment, y, track, {
        fill: alphaGradient(color, [
          {offset: 0, alpha: leftAlpha},
          {offset: BLEND_WIDTH, alpha: opacity},
          {offset: 1 - BLEND_WIDTH, alpha: opacity},
          {offset: 1, alpha: rightAlpha},
        ]),
      })
    );

    const hit = {...segment};

    if (!prevIsAdjacent) {
      const prevRight = (prev && bucketSpan(prev, api)?.right) ?? -Infinity;
      const fade = clampSpan(
        {
          left: Math.round(Math.max(span.left - slotWidth, (prevRight + span.left) / 2)),
          right: span.left,
        },
        track
      );
      if (fade.right > fade.left) {
        children.push(
          bandRect(fade, y, track, {
            fill: alphaGradient(color, [
              {offset: 0, alpha: 0},
              {offset: 1, alpha: opacity},
            ]),
          })
        );
        hit.left = Math.max(fade.left, segment.left - BAND_PADDING);
      }
    }

    if (!nextIsAdjacent) {
      const nextLeft = (next && bucketSpan(next, api)?.left) ?? Infinity;
      const fade = clampSpan(
        {
          left: span.right,
          right: Math.round(
            Math.min(span.right + slotWidth, (span.right + nextLeft) / 2)
          ),
        },
        track
      );
      if (fade.right > fade.left) {
        children.push(
          bandRect(fade, y, track, {
            fill: alphaGradient(color, [
              {offset: 0, alpha: opacity},
              {offset: 1, alpha: 0},
            ]),
          })
        );
        hit.right = Math.min(fade.right, segment.right + BAND_PADDING);
      }
    }

    // Invisible hover target spanning the full band height; the visible
    // shapes are silent so the tooltip always anchors to this rect.
    children.push({
      type: 'rect',
      shape: {x: hit.left, y: bandTop, width: hit.right - hit.left, height: BAND_HEIGHT},
      style: {fill: 'transparent'},
    });

    return {type: 'group', children};
  };
}

/**
 * Smartly determines the position of the tooltip based on the hovered pill and the chart size.
 */
const droppedDataTooltipPosition: TooltipPositionCallback = (
  point,
  _params,
  dom,
  rect,
  size
) => {
  const [tooltipWidth] = size.contentSize;
  const [chartWidth] = size.viewSize;

  const anchorX = rect ? rect.x + rect.width / 2 : point[0];
  const anchorBottom = rect ? rect.y + rect.height : point[1];

  const centeredLeft = anchorX - tooltipWidth / 2;
  const left = Math.max(0, Math.min(centeredLeft, chartWidth - tooltipWidth));

  if (dom instanceof HTMLElement) {
    const arrow = dom.querySelector<HTMLDivElement>('.tooltip-arrow');
    if (arrow) {
      arrow.style.left = left === centeredLeft ? '50%' : `${anchorX - left}px`;
    }
  }

  return [left, anchorBottom + TOOLTIP_GAP];
};

function droppedDataTooltipOption(
  chartRef: React.RefObject<ReactEchartsRef | null>,
  renderTooltip: (bucket: AnnotationBucket) => string
): CustomSeriesOption['tooltip'] {
  return {
    trigger: 'item',
    position: droppedDataTooltipPosition,
    formatter: params => {
      if (!isChartHovered(chartRef.current)) {
        return '';
      }

      return renderTooltip(params.data as DroppedDataItem);
    },
  };
}

function createDroppedDataSeries({
  bandOffset,
  buckets,
  chartRef,
  renderTooltip,
  theme,
  yAxisIndex,
}: DroppedDataSeriesParams): CustomSeriesOption {
  const data: DroppedDataItem[] = buckets.map(bucket => ({
    value: [bucket.start, 0],
    ...bucket,
  }));

  return {
    id: DROPPED_DATA_SERIES_ID,
    type: 'custom',
    yAxisIndex,
    renderItem: droppedDataRenderItem(data, bandOffset, theme),
    name: DROPPED_DATA_SERIES_ID,
    data,
    color: theme.tokens.dataviz.semantic.bad,
    animation: false,
    legendHoverLink: false,
    tooltip: droppedDataTooltipOption(chartRef, renderTooltip),
  };
}

interface UseDroppedDataBandParams {
  chartRef: React.RefObject<ReactEchartsRef | null>;
  bandOffset?: number;
  droppedData?: DroppedDataProps;
  utc?: boolean | null;
  yAxisIndex?: number;
}

export function useDroppedDataBand({
  chartRef,
  droppedData,
  bandOffset = 0,
  utc,
  yAxisIndex,
}: UseDroppedDataBandParams) {
  const theme = useTheme();
  const renderToString = useRenderToString();
  const userTimezone = useTimezone();
  const timezone = utc ? 'UTC' : userTimezone;
  const {acceptedAnnotations, droppedAnnotations} = droppedData ?? {};

  const buckets = useMemo(
    () =>
      groupIntoBuckets(droppedAnnotations ?? [], acceptedAnnotations ?? [])
        .filter(bucket => bucket.ratio > 0)
        .sort((a, b) => a.start - b.start),
    [acceptedAnnotations, droppedAnnotations]
  );
  const isVisible = buckets.length > 0;

  const renderTooltip = useCallback(
    (bucket: AnnotationBucket) =>
      renderToString(<DroppedDataTooltip bucket={bucket} timezone={timezone} />),
    [renderToString, timezone]
  );

  const droppedDataSeries = useMemo(
    () =>
      isVisible
        ? createDroppedDataSeries({
            bandOffset,
            buckets,
            chartRef,
            renderTooltip,
            theme,
            yAxisIndex,
          })
        : null,
    [bandOffset, buckets, chartRef, isVisible, renderTooltip, theme, yAxisIndex]
  );

  return {
    droppedDataSeries,
    droppedDataYAxis: isVisible ? DROPPED_DATA_Y_AXIS : null,
    droppedDataBandHeight: isVisible ? BAND_HEIGHT : 0,
  };
}
