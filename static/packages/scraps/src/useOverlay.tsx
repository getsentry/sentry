import type * as React from 'react';
import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import type {
  Boundary,
  DetectOverflowOptions,
  FlipOptions,
  Middleware,
  Padding,
  Placement,
  Strategy,
} from '@floating-ui/react-dom';
import {detectOverflow, offset as offsetMiddleware} from '@floating-ui/react-dom';
import {useButton as useButtonAria} from '@react-aria/button';
import type {AriaOverlayProps, OverlayTriggerProps} from '@react-aria/overlays';
import {
  useOverlay as useOverlayAria,
  useOverlayTrigger as useOverlayTriggerAria,
} from '@react-aria/overlays';
import {mergeProps} from '@react-aria/utils';
import type {OverlayTriggerProps as OverlayTriggerStateProps} from '@react-stately/overlays';
import {useOverlayTriggerState} from '@react-stately/overlays';

import type {
  OverlayPlacement,
  OverlayPositioning,
  ShiftOverlayOptions,
} from '@sentry/scraps/overlayPositioning';
import {
  anchorOverlay,
  arrowOverlay,
  placementMiddleware,
  shiftOverlay,
} from '@sentry/scraps/overlayPositioning';

/**
 * Floating UI middleware to change the overlay's width/height to prevent
 * overflowing. Based on
 * https://github.com/atomiks/popper.js/blob/master/src/modifiers/maxSize.js
 */
function maxSize(options: DetectOverflowOptions): Middleware {
  return {
    name: 'maxSize',
    options,
    async fn(state) {
      // Measure from where the overlay was before `shift` moved it
      const {x, y} = state.middlewareData.shift ?? {x: 0, y: 0};
      const overflow = await detectOverflow(
        {...state, x: state.x - x, y: state.y - y},
        options
      );
      const {width, height} = state.rects.floating;
      const [basePlacement] = state.placement.split('-');

      const widthSide = basePlacement === 'left' ? 'left' : 'right';
      const heightSide = basePlacement === 'top' ? 'top' : 'bottom';

      const flippedWidthSide = basePlacement === 'left' ? 'right' : 'left';
      const flippedHeightSide = basePlacement === 'top' ? 'bottom' : 'top';

      const maxHeight =
        basePlacement === 'left' || basePlacement === 'right'
          ? // If the main axis is horizontal, then maxHeight = the boundary's height
            height - overflow.top - overflow.bottom
          : // Otherwise, set max height unless there is enough space on the other side to
            // flip the overlay to
            Math.max(height - overflow[heightSide] - y, -overflow[flippedHeightSide]);

      // If there is enough space on the other side, then allow the overlay to flip
      // without constraining its size
      const maxWidth =
        basePlacement === 'top' || basePlacement === 'bottom'
          ? // If the main axis is vertical, then maxWidth = the boundary's width
            width - overflow.left - overflow.right
          : // Otherwise, set max width unless there is enough space on the other side to
            // flip the overlay to
            Math.max(width - overflow[widthSide] - x, -overflow[flippedWidthSide]);

      return {data: {width: maxWidth, height: maxHeight}};
    },
  };
}

const referenceWidth: Middleware = {
  name: 'referenceWidth',
  fn: ({rects}) => ({data: {width: rects.reference.width}}),
};

export interface UseOverlayProps
  extends
    Partial<AriaOverlayProps>,
    Partial<OverlayTriggerProps>,
    Partial<OverlayTriggerStateProps> {
  /**
   * Options to pass to the `arrow` middleware.
   */
  arrowOptions?: {padding?: Padding};
  disableTrigger?: boolean;
  /**
   * Options to pass to the `flip` middleware.
   */
  flipOptions?: FlipOptions;
  /**
   * Fallback for `preventOverflowOptions.boundary`, called when the overlay opens
   * (and again if the function changes). Use it for boundaries that need a DOM
   * query so the query doesn't run on every render; keep the function stable.
   */
  getOverflowBoundary?: () => Boundary | undefined;
  /**
   * Offset value. If a single number, determines the _distance_ along the main axis. If
   * an array of two numbers, the first number determines the _skidding_ along the alt
   * axis, and the second determines the _distance_ along the main axis.
   */
  offset?: number | [number, number];
  /**
   * To be called when the overlay closes because of a user interaction (click) outside
   * the overlay. Note: this won't be called when the user presses Escape to dismiss.
   */
  onInteractOutside?: () => void;
  /**
   * Position for the overlay.
   */
  position?: OverlayPlacement;
  /**
   * Options to pass to the `shift` middleware, which keeps the overlay inside
   * its boundary.
   */
  preventOverflowOptions?: ShiftOverlayOptions;
  /**
   * By default, the overlay's min-width will match the trigger's width.
   * If this is not desired, set to `false`.
   */
  shouldApplyMinWidth?: boolean;
  /**
   * Strategy for the overlay. See
   * https://floating-ui.com/docs/computePosition#strategy for details.
   */
  strategy?: Strategy;
}

interface UseOverlayResult {
  arrowProps: {
    placement: Placement;
    style: React.CSSProperties | undefined;
  };
  isOpen: boolean;
  overlayProps: ReturnType<typeof useOverlayTriggerAria>['overlayProps'] &
    ReturnType<typeof useOverlayAria>['overlayProps'] & {
      'data-overlay-root': '';
      positioning: OverlayPositioning;
      ref: React.Dispatch<React.SetStateAction<HTMLDivElement | null>>;
      style: React.CSSProperties | undefined;
    };
  overlayRef: {current: HTMLDivElement | null};
  state: ReturnType<typeof useOverlayTriggerState>;
  triggerProps: ReturnType<typeof useButtonAria>['buttonProps'] & {
    ref: React.Dispatch<React.SetStateAction<HTMLElement | null>>;
  };
  triggerRef: {current: HTMLElement | null};
  update: () => void;
}

export function useOverlay({
  isOpen,
  onClose,
  defaultOpen,
  onOpenChange,
  type = 'dialog',
  offset = 8,
  position = 'top',
  arrowOptions = {},
  flipOptions = {},
  preventOverflowOptions = {},
  getOverflowBoundary,
  shouldApplyMinWidth = true,
  isDismissable = true,
  shouldCloseOnBlur = false,
  isKeyboardDismissDisabled,
  shouldCloseOnInteractOutside,
  onInteractOutside,
  disableTrigger,
  strategy = 'absolute',
}: UseOverlayProps = {}): UseOverlayResult {
  // Callback refs for Floating UI
  // TODO: Use ref callbacks instead of holding the trigger and overlay elements in state
  const [triggerElement, setTriggerElement] = useState<HTMLElement | null>(null);
  const [overlayElement, setOverlayElement] = useState<HTMLDivElement | null>(null);

  const openState = useOverlayTriggerState({isOpen, defaultOpen, onOpenChange});

  // Ref objects for react-aria (useOverlayTrigger & useOverlay)
  const triggerRef = useMemo(() => ({current: triggerElement}), [triggerElement]);
  const overlayRef = useMemo(() => ({current: overlayElement}), [overlayElement]);

  // There is nothing to position while the overlay is closed, so skip the lookup
  const hasBoundary = !!preventOverflowOptions.boundary;
  const fallbackBoundary = useMemo(
    () => (openState.isOpen && !hasBoundary ? getOverflowBoundary?.() : undefined),
    [openState.isOpen, hasBoundary, getOverflowBoundary]
  );

  const {placement: initialPlacement, middleware} = useMemo(() => {
    const placement = placementMiddleware(position, {
      // Only flip on main axis
      flipAlignment: false,
      ...flipOptions,
    });
    const overflowOptions = {
      padding: 16,
      ...preventOverflowOptions,
      ...(fallbackBoundary && {boundary: fallbackBoundary}),
    };

    return {
      placement: placement.placement,
      middleware: [
        offsetMiddleware(
          Array.isArray(offset) ? {crossAxis: offset[0], mainAxis: offset[1]} : offset
        ),
        placement.middleware,
        shiftOverlay(overflowOptions),
        arrowOverlay({
          // Set padding to avoid the arrow reaching the side of the tooltip
          // and overflowing out of the rounded border
          padding: 4,
          ...arrowOptions,
        }),
        maxSize(overflowOptions),
        ...(shouldApplyMinWidth ? [referenceWidth] : []),
        anchorOverlay,
      ],
    };
  }, [
    arrowOptions,
    flipOptions,
    offset,
    position,
    preventOverflowOptions,
    fallbackBoundary,
    shouldApplyMinWidth,
  ]);

  // `PositionWrapper` positions the overlay. It reports a flip back, so the
  // owner only re-renders when the placement changes.
  const [placement, setPlacement] = useState<Placement>(initialPlacement);
  const updateRef = useRef<(() => void) | null>(null);
  const update = useCallback(() => updateRef.current?.(), []);
  const positioning = useMemo<OverlayPositioning>(
    () => ({
      reference: triggerElement,
      floating: overlayElement,
      middleware,
      placement: initialPlacement,
      strategy,
      isOpen: openState.isOpen,
      onPlacementChange: setPlacement,
      updateRef,
    }),
    [
      triggerElement,
      overlayElement,
      middleware,
      initialPlacement,
      strategy,
      openState.isOpen,
    ]
  );

  useEffect(() => {
    if (
      process.env.NODE_ENV !== 'production' &&
      openState.isOpen &&
      overlayElement?.isConnected &&
      !updateRef.current
    ) {
      // eslint-disable-next-line no-console
      console.error(
        'useOverlay: render the overlay with <PositionWrapper {...overlayProps}>, or it is not positioned.'
      );
    }
  }, [openState.isOpen, overlayElement]);

  // The sizes change with the position, so the content reads them through
  // custom properties that `PositionWrapper` sets. This style never changes.
  const overlayStyle = useMemo<React.CSSProperties>(
    () => ({
      maxHeight: 'var(--overlay-max-height)',
      maxWidth: 'var(--overlay-max-width)',
      ...(shouldApplyMinWidth && {minWidth: 'var(--overlay-min-width)'}),
    }),
    [shouldApplyMinWidth]
  );

  // The arrow keeps its stylesheet position on the axis it does not follow
  const isVertical = placement.startsWith('top') || placement.startsWith('bottom');
  const arrowStyle = useMemo<React.CSSProperties>(
    () => ({
      position: 'absolute',
      ...(isVertical
        ? {left: 'var(--overlay-arrow-x)'}
        : {top: 'var(--overlay-arrow-y)'}),
    }),
    [isVertical]
  );

  // Get props for trigger button
  const {triggerProps, overlayProps: overlayTriggerAriaProps} = useOverlayTriggerAria(
    {type},
    openState,
    triggerRef
  );
  const {buttonProps: triggerAriaProps} = useButtonAria(
    {...triggerProps, isDisabled: disableTrigger},
    triggerRef
  );

  // Get props for overlay element
  const interactedOutside = useRef(false);
  const interactOutsideTrigger = useRef<HTMLElement | null>(null);
  const isClosing = useRef(false);
  const {overlayProps: overlayAriaProps} = useOverlayAria(
    {
      onClose: () => {
        // Prevent onClose from triggering multiple times when clicking outside
        isClosing.current = true;
        onClose?.();

        if (interactedOutside.current) {
          onInteractOutside?.();
          interactedOutside.current = false;
          const trigger = interactOutsideTrigger.current;
          interactOutsideTrigger.current = null;

          // When changing this, check that you can switch between dropdowns with a single click
          trigger?.focus();
          trigger?.click();
        }

        openState.close();
        isClosing.current = false;
      },
      isOpen: openState.isOpen,
      isDismissable,
      shouldCloseOnBlur,
      isKeyboardDismissDisabled,
      shouldCloseOnInteractOutside: target => {
        if (
          target &&
          triggerRef.current !== target &&
          !triggerRef.current?.contains(target) &&
          (shouldCloseOnInteractOutside?.(target) ?? true) &&
          !isClosing.current
        ) {
          // Check if the target is inside a different overlay trigger. If yes, then we
          // should activate that trigger after this overlay has closed (see the onClose
          // prop above). This allows users to quickly jump between adjacent overlays.
          const closestOverlayTrigger = target.closest?.<HTMLElement>(
            '[aria-expanded="false"]'
          );
          if (closestOverlayTrigger && closestOverlayTrigger !== triggerRef.current) {
            interactOutsideTrigger.current = closestOverlayTrigger;
          } else {
            interactOutsideTrigger.current = null;
          }

          interactedOutside.current = true;
          return true;
        }
        return false;
      },
    },
    overlayRef
  );

  return {
    isOpen: openState.isOpen,
    state: openState,
    update,
    triggerRef,
    triggerProps: {
      ref: setTriggerElement,
      ...triggerAriaProps,
    },
    overlayRef,
    overlayProps: {
      ref: setOverlayElement,
      style: overlayStyle,
      positioning,
      'data-overlay-root': '',
      ...mergeProps(overlayTriggerAriaProps, overlayAriaProps),
    },
    arrowProps: {
      style: arrowStyle,
      placement,
    },
  };
}
