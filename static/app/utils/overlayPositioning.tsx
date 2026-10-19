import type {
  Alignment,
  Coords,
  Dimensions,
  FlipOptions,
  Middleware,
  MiddlewareState,
  Padding,
  Placement,
  ShiftOptions,
  Strategy,
} from '@floating-ui/react-dom';
import {arrow, autoPlacement, flip, limitShift, shift} from '@floating-ui/react-dom';

/**
 * Where to place an overlay relative to its trigger. The `auto` positions
 * pick whichever side has the most space.
 */
export type OverlayPlacement = Placement | 'auto' | 'auto-start' | 'auto-end';

/**
 * Resolves a requested position to the placement passed to Floating UI and
 * the middleware that may change it: `autoPlacement()` for the `auto`
 * positions, otherwise `flipOverlay()`.
 */
export function placementMiddleware(
  position: OverlayPlacement,
  flipOptions: FlipOptions = {}
): {middleware: Middleware; placement: Placement} {
  if (position === 'auto' || position === 'auto-start' || position === 'auto-end') {
    const {
      mainAxis: _mainAxis,
      crossAxis: _crossAxis,
      fallbackPlacements: _fallbackPlacements,
      fallbackStrategy: _fallbackStrategy,
      fallbackAxisSideDirection: _fallbackAxisSideDirection,
      flipAlignment = true,
      ...detectOverflowOptions
    } = flipOptions;
    const alignment: Alignment | undefined =
      position === 'auto-start' ? 'start' : position === 'auto-end' ? 'end' : undefined;

    return {
      placement: alignment ? `top-${alignment}` : 'top',
      middleware: autoPlacement({
        ...detectOverflowOptions,
        alignment,
        autoAlignment: flipAlignment,
      }),
    };
  }

  return {placement: position, middleware: flipOverlay(flipOptions)};
}

/**
 * Floating UI's `flip()`, but when no placement fits on its main axis the
 * requested placement is kept instead of guessing the best fit.
 */
export function flipOverlay(options: FlipOptions = {}): Middleware {
  return flip({fallbackStrategy: 'initialPlacement', ...options});
}

export interface OverlayAnchor {
  bottom?: number;
  right?: number;
}

/**
 * Anchors the overlay by the edges nearest its trigger, the way Popper's
 * adaptive styles did. An overlay whose content changes size, such as a
 * hovercard that finishes loading, then grows away from its trigger instead of
 * over it until it is repositioned. Apply the result with `anchoredStyles()`.
 *
 * Must be the last middleware, so it sees the final position.
 */
export const anchorOverlay: Middleware = {
  name: 'anchor',
  async fn({x, y, placement, rects, elements, platform, strategy}) {
    const [side, alignment] = placement.split('-');
    const isVertical = side === 'top' || side === 'bottom';
    const anchorBottom = side === 'top' || (!isVertical && alignment === 'end');
    const anchorRight = side === 'left' || (isVertical && alignment === 'end');

    if (!anchorBottom && !anchorRight) {
      return {};
    }

    const {floating} = elements;
    const offsetParent = await platform.getOffsetParent?.(floating);
    const container: Dimensions =
      offsetParent && (await platform.isElement?.(offsetParent))
        ? {
            width: (offsetParent as Element).clientWidth,
            height: (offsetParent as Element).clientHeight,
          }
        : getRootContainingBlock(floating, strategy);

    // Round to the device's pixels, as Floating UI does for `top` and `left`
    const dpr = floating.ownerDocument.defaultView?.devicePixelRatio || 1;
    const round = (value: number) => Math.round(value * dpr) / dpr;

    const anchor: OverlayAnchor = {};
    if (anchorBottom) {
      anchor.bottom = round(container.height - y - rects.floating.height);
    }
    if (anchorRight) {
      anchor.right = round(container.width - x - rects.floating.width);
    }
    return {data: anchor};
  },
};

/**
 * Without a positioned ancestor, the overlay is placed in the viewport, or in
 * the document when the root element is positioned.
 */
function getRootContainingBlock(floating: HTMLElement, strategy: Strategy): Dimensions {
  const root = floating.ownerDocument.documentElement;
  const isDocument =
    strategy === 'absolute' &&
    floating.ownerDocument.defaultView?.getComputedStyle(root).position !== 'static';

  return isDocument
    ? {width: root.scrollWidth, height: root.scrollHeight}
    : {width: root.clientWidth, height: root.clientHeight};
}

/**
 * Floating UI's `floatingStyles`, positioned by the edges `anchorOverlay()`
 * chose.
 */
export function anchoredStyles(
  floatingStyles: React.CSSProperties,
  anchor: OverlayAnchor | undefined
): React.CSSProperties {
  return {
    ...floatingStyles,
    ...(anchor?.bottom === undefined ? {} : {top: 'auto', bottom: anchor.bottom}),
    ...(anchor?.right === undefined ? {} : {left: 'auto', right: anchor.right}),
  };
}

/**
 * The overlay's arrow, an `OverlayArrow` rendered inside the floating element.
 */
function getArrow(floating: HTMLElement) {
  return floating.querySelector<HTMLElement>('[data-overlay-arrow]');
}

/**
 * Floating UI's `arrow()`, pointing the overlay's `OverlayArrow` at its trigger.
 */
export function arrowOverlay(options: {padding?: Padding} = {}): Middleware {
  return {
    name: 'arrow',
    options,
    fn(state) {
      const element = getArrow(state.elements.floating);
      return element ? arrow({...options, element}).fn(state) : {};
    },
  };
}

export interface ShiftOverlayOptions extends ShiftOptions {
  /**
   * Stop the overlay from shifting so far that it detaches from its trigger.
   * @default true
   */
  tether?: boolean;
}

/**
 * Floating UI's `shift()`, by default limited so the overlay never shifts so
 * far that it detaches from its trigger. With an arrow, enough of the overlay
 * stays beside the trigger for the arrow to point at it.
 *
 * Unlike `limitShift()`, this only limits how far the overlay is shifted. An
 * offset that already places the overlay away from its trigger is kept.
 */
export function shiftOverlay(options: ShiftOverlayOptions = {}): Middleware {
  const {tether = true, ...shiftOptions} = options;

  return {
    name: 'shift',
    options,
    fn(state) {
      const limiter = tether
        ? tetherLimiter(state, getArrow(state.elements.floating))
        : undefined;
      return shift({limiter, ...shiftOptions}).fn(state);
    },
  };
}

function tetherLimiter(origin: Coords, arrowElement: HTMLElement | null) {
  // `limitShift()` already stops the overlay from shifting past its trigger
  // along the cross axis
  const crossAxisLimiter = limitShift({mainAxis: false});

  return {
    fn(state: MiddlewareState): Coords {
      const coords = crossAxisLimiter.fn(state);
      const isVertical =
        state.placement.startsWith('top') || state.placement.startsWith('bottom');
      const axis = isVertical ? 'x' : 'y';
      const length = isVertical ? 'width' : 'height';
      const {reference, floating} = state.rects;

      const arrowLength = Math.min(
        (isVertical ? arrowElement?.offsetWidth : arrowElement?.offsetHeight) ?? 0,
        reference[length]
      );
      const min = reference[axis] - floating[length] + arrowLength;
      const max = reference[axis] + reference[length] - arrowLength;

      const start = origin[axis];
      const shifted = state[axis];

      if (shifted > start) {
        coords[axis] = Math.max(start, Math.min(shifted, max));
      } else if (shifted < start) {
        coords[axis] = Math.min(start, Math.max(shifted, min));
      }

      return coords;
    },
  };
}
