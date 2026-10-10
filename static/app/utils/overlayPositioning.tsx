import type {
  Alignment,
  Coords,
  FlipOptions,
  Middleware,
  MiddlewareState,
  Padding,
  Placement,
  ShiftOptions,
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

/**
 * Floating UI's `shift()`, limited so the overlay never shifts so far that it
 * detaches from its trigger. With an arrow, enough of the overlay stays beside
 * the trigger for the arrow to point at it.
 *
 * Unlike `limitShift()`, this only limits how far the overlay is shifted. An
 * offset that already places the overlay away from its trigger is kept.
 */
export function shiftOverlay(options: ShiftOptions = {}): Middleware {
  return {
    name: 'shift',
    options,
    fn(state) {
      const limiter = tether(state, getArrow(state.elements.floating));
      return shift({limiter, ...options}).fn(state);
    },
  };
}

function tether(origin: Coords, arrowElement: HTMLElement | null) {
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
