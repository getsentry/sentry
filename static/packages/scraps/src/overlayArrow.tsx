import type * as React from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import type {Placement} from '@floating-ui/react-dom';

/**
 * @internal The frame `Overlay` draws around its box. The overlay's styles draw
 * it and the arrow's shape joins it, so the box, the arrow and their focus
 * rings all change together.
 */
export const overlayFrame = {
  /** The box's border. The arrow's base sits on its inner edge and covers it. */
  borderWidth: 1,
  /** The box's bottom shadow, which lifts its bottom edge and the arrows on it. */
  liftHeight: 2,
  /** The focus ring around the box and the arrow. */
  focusRingWidth: 2,
} as const;

/**
 * @internal The color of the arrow's focus ring. `overlayFocusRing` sets it;
 * while it's unset, the ring isn't painted.
 */
export const arrowFocusRingVar = '--overlay-arrow-focus-ring';

export interface OverlayArrowProps extends React.ComponentPropsWithRef<'div'> {
  placement?: Placement;
  ref?: React.Ref<HTMLDivElement>;
  size?: number;
  strokeWidth?: number;
}

/** The side of its trigger the overlay is placed on. */
type PlacementSide = 'top' | 'bottom' | 'left' | 'right';

type Point = readonly [x: number, y: number];
type Polygon = readonly Point[];

/**
 * The arrow in its own coordinates, before its wrapper rotates it toward the
 * trigger. The base lies on y = 0, the inner edge of the box's border, and the
 * tip points toward +y.
 */
interface ArrowShape {
  /** Filled with the background color, over the outline and the box's border. */
  interior: Polygon;
  /**
   * Filled with the border color, in this order. The first polygon contains
   * the others: it's the arrow's silhouette, which the focus ring follows.
   */
  outline: readonly [silhouette: Polygon, ...rest: Polygon[]];
  /** How far from the base the focus ring starts: where the box's own ring starts. */
  ringInset: number;
}

const sizeRatio = 0.5;
const heightRatio = 0.3;
/** How far in from each end of the base the interior starts. Tuned by eye. */
const interiorInset = {lifted: 3, flat: 1.5} as const;
/** Room around the arrow for its ring: the ring's miter, plus a side arrow's lift. */
const ringBleed = 2 * overlayFrame.focusRingWidth + overlayFrame.liftHeight + 2;

function getPlacementSide(placement: Placement | undefined): PlacementSide | undefined {
  return placement?.split('-')[0] as PlacementSide | undefined;
}

/**
 * Everything the arrow paints. This is the only code that knows the arrow's
 * shape, so its focus ring follows any change to it.
 */
function getArrowShape(size: number, side: PlacementSide | undefined): ArrowShape {
  const half = size / 2;
  const height = size * heightRatio;
  // An arrow on the box's bottom edge hangs from its lift as well as its border.
  const isLifted = side === 'top';
  const frameDepth = overlayFrame.borderWidth + (isLifted ? overlayFrame.liftHeight : 0);
  const tip = height + frameDepth;

  const triangle: Polygon = [
    [0, 0],
    [size, 0],
    [half, tip],
  ];
  const inset = isLifted ? interiorInset.lifted : interiorInset.flat;
  const interior: Polygon = [
    [inset, 0],
    [size - inset, 0],
    [half, height],
  ];

  // An arrow on a side edge carries the box's lift: its triangle swept toward
  // the bottom of the screen, which is local +x under the wrapper's 90deg
  // rotation and local -x under -90deg.
  const sweep =
    side === 'right'
      ? overlayFrame.liftHeight
      : side === 'left'
        ? -overlayFrame.liftHeight
        : 0;
  if (sweep === 0) {
    return {outline: [triangle], interior, ringInset: frameDepth};
  }
  const low = Math.min(0, sweep);
  const high = Math.max(0, sweep);
  const lift: Polygon = [
    [low, 0],
    [size + high, 0],
    [half + high, tip],
    [half + low, tip],
  ];
  return {outline: [lift, triangle], interior, ringInset: frameDepth};
}

function toPoints(polygon: Polygon): string {
  return polygon.map(([x, y]) => `${x},${y}`).join(' ');
}

export function OverlayArrow({placement, ref, size = 16, ...props}: OverlayArrowProps) {
  const theme = useTheme();
  const {outline, interior, ringInset} = getArrowShape(size, getPlacementSide(placement));
  const ringWidth = size + 2 * ringBleed;

  return (
    // `data-overlay-arrow` lets overlay positioning find the arrow
    <OverlayArrowWrap
      data-overlay-arrow
      dimensions={size}
      ref={ref}
      placement={placement}
      {...props}
    >
      {/* Starts where the box's ring starts, so the ring never covers the box's frame. */}
      <ArrowRingViewport
        aria-hidden
        viewBox={`${-ringBleed} ${ringInset} ${ringWidth} ${size}`}
        style={{left: -ringBleed, top: ringInset, width: ringWidth, height: size}}
      >
        {/* Centered on the silhouette: its outer half is the ring, its inner half sits under the arrow. */}
        <ArrowRing points={toPoints(outline[0])} />
      </ArrowRingViewport>
      <svg
        viewBox={`0 0 ${size} ${size * sizeRatio}`}
        fill="none"
        style={{display: 'block'}}
      >
        {outline.map(polygon => (
          <polygon
            key={toPoints(polygon)}
            points={toPoints(polygon)}
            fill={theme.tokens.border.primary}
          />
        ))}
        <polygon points={toPoints(interior)} fill={theme.tokens.background.primary} />
      </svg>
    </OverlayArrowWrap>
  );
}

const OverlayArrowWrap = styled('div')<{
  dimensions: number;
  placement?: Placement;
}>`
  width: ${p => p.dimensions}px;
  height: ${p =>
    p.placement?.startsWith('left') || p.placement?.startsWith('right')
      ? p.dimensions
      : p.dimensions * sizeRatio}px;
  position: absolute;
  transform-origin: center;
  /* Keeps the ring's negative z-index inside the arrow. */
  isolation: isolate;

  ${p =>
    p.placement?.startsWith('top') && 'top: 100%; left: 50%; transform: rotate(0deg);'}
  ${p =>
    p.placement?.startsWith('bottom') &&
    'bottom: 100%; left: 50%; transform: rotate(180deg);'}
  ${p =>
    p.placement?.startsWith('left') && 'left: 100%; top: 50%; transform: rotate(-90deg);'}
  ${p =>
    p.placement?.startsWith('right') &&
    'right: 100%; top: 50%; transform: rotate(90deg);'}
`;

/** Behind the arrow. Its viewport clips the ring. */
const ArrowRingViewport = styled('svg')`
  position: absolute;
  z-index: -1;
  overflow: hidden;
  pointer-events: none;
`;

const ArrowRing = styled('polygon')`
  fill: none;
  stroke: var(${arrowFocusRingVar}, none);
  stroke-width: ${2 * overlayFrame.focusRingWidth}px;
  stroke-linejoin: miter;
  stroke-miterlimit: 10;
`;
