import type {Theme} from '@emotion/react';
import type {
  CustomSeriesRenderItemAPI,
  CustomSeriesRenderItemParams,
  CustomSeriesRenderItemReturn,
} from 'echarts';
import type {ZRColor} from 'echarts/types/dist/shared';

import {defined} from 'sentry/utils/defined';

const BAND_PADDING_TOP = 2;
const BAND_PADDING_BOTTOM = 3;
const BOX_HEIGHT = 4;
const BOX_BORDER_RADIUS = 2;

export const BAND_HEIGHT = BAND_PADDING_TOP + BOX_HEIGHT + BAND_PADDING_BOTTOM;

/**
 * Above line, area, and bar series so a bucket highlight covers them, and
 * below mark lines such as releases.
 */
export const BAND_Z = 4;

const HIGHLIGHT_DIM_OPACITY = 0.6;
const HIGHLIGHT_WASH_OPACITY = 0.1;

/**
 * Each band gets its own hidden y-axis so its series never affects the scale
 * of the plotted data.
 */
export const BAND_Y_AXIS = {
  type: 'value' as const,
  min: 0,
  max: 100,
  show: false,
  axisLabel: {show: false},
  axisPointer: {show: false},
};

type BandGroup = Extract<NonNullable<CustomSeriesRenderItemReturn>, {type: 'group'}>;
export type BandElement = BandGroup['children'][number];

export type CartesianCoordSys = CustomSeriesRenderItemParams['coordSys'] & {
  height: number;
  width: number;
  x: number;
  y: number;
};

export interface BandBucket {
  end: number;
  start: number;
}

export interface PixelRange {
  left: number;
  right: number;
}

interface BandLayout {
  track: PixelRange;
  y: number;
}

export function clampRange({left, right}: PixelRange, track: PixelRange): PixelRange {
  return {
    left: Math.min(Math.max(left, track.left), track.right),
    right: Math.min(Math.max(right, track.left), track.right),
  };
}

/**
 * Centred on the bucket start to line up with bar series, and rounded so
 * neighbouring buckets meet without anti-aliased seams.
 */
export function bucketSlot(
  bucket: BandBucket,
  api: CustomSeriesRenderItemAPI
): PixelRange | null {
  const [startX] = api.coord([bucket.start, 0]);
  const [endX] = api.coord([bucket.end, 0]);

  if (!defined(startX) || !defined(endX)) {
    return null;
  }

  const halfSlot = (endX - startX) / 2;
  return {left: Math.round(startX - halfSlot), right: Math.round(endX - halfSlot)};
}

/**
 * Places a band `offset` pixels below the bottom of the plot, spanning the
 * plot's full width.
 */
export function bandLayout(
  bucket: BandBucket,
  offset: number,
  params: CustomSeriesRenderItemParams,
  api: CustomSeriesRenderItemAPI
): BandLayout | null {
  const [, baseY] = api.coord([bucket.start, 0]);
  if (!defined(baseY)) {
    return null;
  }

  const {x, width} = params.coordSys as CartesianCoordSys;
  return {
    track: {left: x, right: x + width},
    y: baseY + offset + BAND_PADDING_TOP,
  };
}

/**
 * Rounds only the corners that sit on the ends of the track, so segments
 * inside the band read as one continuous line. Silent, since hovering goes
 * through `bandHoverTarget`.
 */
export function bandRect(
  range: PixelRange,
  y: number,
  track: PixelRange,
  fill: ZRColor,
  {opacity = 1, ...options}: {opacity?: number; z2?: number} = {}
): BandElement {
  const left = range.left <= track.left ? BOX_BORDER_RADIUS : 0;
  const right = range.right >= track.right ? BOX_BORDER_RADIUS : 0;

  return {
    type: 'rect',
    silent: true,
    ...options,
    shape: {
      x: range.left,
      y,
      width: range.right - range.left,
      height: BOX_HEIGHT,
      r: [left, right, right, left],
    },
    style: {fill, opacity},
  };
}

/**
 * Covers the bucket across the band's full height, padding included, so
 * stacked bands meet without a gap that ignores the mouse.
 */
export function bandHoverTarget(range: PixelRange, y: number): BandElement {
  return {
    type: 'rect',
    shape: {
      x: range.left,
      y: y - BAND_PADDING_TOP,
      width: range.right - range.left,
      height: BAND_HEIGHT,
    },
    style: {fill: 'transparent'},
  };
}

/**
 * The muted background that runs the full width of the band, drawn behind
 * the band's boxes.
 */
export function bandTrack(track: PixelRange, y: number, theme: Theme): BandElement {
  return bandRect(track, y, track, theme.tokens.background.secondary, {z2: -1});
}

/**
 * Silent rects over the plot that only show while the bucket is hovered: the
 * plot dims on either side and the bucket itself gets a light wash. They live
 * in the item so ECharts toggles them through emphasis without `setOption`.
 */
export function bucketHighlight(
  slot: PixelRange,
  params: CustomSeriesRenderItemParams,
  theme: Theme
): BandElement[] {
  const {x, y, width, height} = params.coordSys as CartesianCoordSys;
  const plot = {left: x, right: x + width};
  const bucket = clampRange(slot, plot);
  const dim = {fill: theme.tokens.background.primary, opacity: HIGHLIGHT_DIM_OPACITY};
  const wash = {
    fill: theme.tokens.graphics.accent.vibrant,
    opacity: HIGHLIGHT_WASH_OPACITY,
  };

  return [
    {range: {left: plot.left, right: bucket.left}, ...dim},
    {range: {left: bucket.right, right: plot.right}, ...dim},
    {range: bucket, ...wash},
  ].map(({range, fill, opacity}) => ({
    type: 'rect',
    silent: true,
    shape: {x: range.left, y, width: range.right - range.left, height},
    style: {fill, opacity: 0},
    emphasis: {style: {opacity}},
  }));
}
