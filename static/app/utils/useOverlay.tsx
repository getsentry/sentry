import {useMemo, useRef, useState} from 'react';
import type {PopperProps} from 'react-popper';
import {usePopper} from 'react-popper';
import type {Modifier} from '@popperjs/core';
import {detectOverflow} from '@popperjs/core';
import type {ArrowModifier} from '@popperjs/core/lib/modifiers/arrow';
import type {FlipModifier} from '@popperjs/core/lib/modifiers/flip';
import type {PreventOverflowModifier} from '@popperjs/core/lib/modifiers/preventOverflow';
import {useButton as useButtonAria} from '@react-aria/button';
import type {AriaOverlayProps, OverlayTriggerProps} from '@react-aria/overlays';
import {
  useOverlay as useOverlayAria,
  useOverlayTrigger as useOverlayTriggerAria,
} from '@react-aria/overlays';
import {mergeProps} from '@react-aria/utils';
import type {OverlayTriggerProps as OverlayTriggerStateProps} from '@react-stately/overlays';
import {useOverlayTriggerState} from '@react-stately/overlays';

/**
 * PopperJS modifier to change the popper element's width/height to prevent
 * overflowing. Based on
 * https://github.com/atomiks/popper.js/blob/master/src/modifiers/maxSize.js
 */
const maxSize: Modifier<'maxSize', NonNullable<PreventOverflowModifier['options']>> = {
  name: 'maxSize',
  phase: 'main',
  requiresIfExists: ['offset', 'preventOverflow', 'flip'],
  enabled: false, // will be enabled when overlay is open
  fn({state, name, options}) {
    const overflow = detectOverflow(state, options);
    const {x, y} = state.modifiersData.preventOverflow ?? {x: 0, y: 0};
    const {width, height} = state.rects.popper;
    const [basePlacement] = state.placement.split('-');

    const widthSide = basePlacement === 'left' ? 'left' : 'right';
    const heightSide = basePlacement === 'top' ? 'top' : 'bottom';

    const flippedWidthSide = basePlacement === 'left' ? 'right' : 'left';
    const flippedHeightSide = basePlacement === 'top' ? 'bottom' : 'top';

    const maxHeight = ['left', 'right'].includes(basePlacement!)
      ? // If the main axis is horizontal, then maxHeight = the boundary's height
        height - overflow.top - overflow.bottom
      : // Otherwise, set max height unless there is enough space on the other side to
        // flip the popper to
        Math.max(height - overflow[heightSide] - y, -overflow[flippedHeightSide]);

    // If there is enough space on the other side, then allow the popper to flip
    // without constraining its size
    const maxWidth = ['top', 'bottom'].includes(basePlacement!)
      ? // If the main axis is vertical, then maxWidth = the boundary's width
        width - overflow.left - overflow.right
      : // Otherwise, set max width unless there is enough space on the other side to
        // flip the popper to
        Math.max(width - overflow[widthSide] - x, -overflow[flippedWidthSide]);

    state.modifiersData[name] = {
      width: maxWidth,
      height: maxHeight,
    };
  },
};

const applyMaxSize: Modifier<'applyMaxSize', {}> = {
  name: 'applyMaxSize',
  phase: 'beforeWrite',
  requires: ['maxSize'],
  enabled: false, // will be enabled when overlay is open
  fn({state}) {
    const {width, height} = state.modifiersData.maxSize;
    state.styles.popper!.maxHeight = height;
    state.styles.popper!.maxWidth = width;
  },
};

const applyMinWidth: Modifier<'applyMinWidth', {}> = {
  name: 'applyMinWidth',
  phase: 'beforeWrite',
  enabled: false, // will be enabled when overlay is open
  fn({state}) {
    const {reference} = state.rects;
    state.styles.popper!.minWidth = `${reference.width}px`;
  },
};

export interface UseOverlayProps
  extends Partial<AriaOverlayProps>,
    Partial<OverlayTriggerProps>,
    Partial<OverlayTriggerStateProps> {
  /**
   * Options to pass to the `arrow` modifier.
   */
  arrowOptions?: ArrowModifier['options'];
  disableTrigger?: boolean;
  /**
   * Options to pass to the `flip` modifier.
   */
  flipOptions?: FlipModifier['options'];
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
  position?: PopperProps<any>['placement'];
  /**
   * Options to pass to the `preventOverflow` modifier.
   */
  preventOverflowOptions?: PreventOverflowModifier['options'];
  /**
   * By default, the overlay's min-width will match the trigger's width.
   * If this is not desired, set to `false`.
   */
  shouldApplyMinWidth?: boolean;
}

function useOverlay({
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
  shouldApplyMinWidth = true,
  isDismissable = true,
  shouldCloseOnBlur = false,
  isKeyboardDismissDisabled,
  shouldCloseOnInteractOutside,
  onInteractOutside,
  disableTrigger,
}: UseOverlayProps = {}) {
  // Callback refs for react-popper
  const [triggerElement, setTriggerElement] = useState<HTMLElement | null>(null);
  const [overlayElement, setOverlayElement] = useState<HTMLDivElement | null>(null);
  const [arrowElement, setArrowElement] = useState<HTMLDivElement | null>(null);

  // Initialize open state
  const openState = useOverlayTriggerState({
    isOpen,
    defaultOpen,
    onOpenChange: open => {
      if (open) {
        popperUpdate?.();
      }
      onOpenChange?.(open);
    },
  });

  // Ref objects for react-aria (useOverlayTrigger & useOverlay)
  const triggerRef = useMemo(() => ({current: triggerElement}), [triggerElement]);
  const overlayRef = useMemo(() => ({current: overlayElement}), [overlayElement]);

  const modifiers = useMemo(
    () => [
      {
        name: 'hide',
        enabled: false,
      },
      {
        name: 'computeStyles',
        options: {
          // Using the `transform` attribute causes our borders to get blurry
          // in chrome. See [0]. This just causes it to use `top` / `left`
          // positions, which should be fine.
          //
          // [0]: https://stackoverflow.com/questions/29543142/css3-transformation-blurry-borders
          gpuAcceleration: false,
        },
      },
      {
        name: 'arrow',
        options: {
          element: arrowElement,
          // Set padding to avoid the arrow reaching the side of the tooltip
          // and overflowing out of the rounded border
          padding: 4,
          ...arrowOptions,
        },
      },
      {
        name: 'flip',
        options: {
          // Only flip on main axis
          flipVariations: false,
          ...flipOptions,
        },
      },
      {
        name: 'offset',
        options: {
          offset: Array.isArray(offset) ? offset : [0, offset],
        },
      },
      {
        name: 'preventOverflow',
        enabled: true,
        options: {
          padding: 16,
          ...preventOverflowOptions,
        },
      },
      {
        ...maxSize,
        enabled: openState.isOpen,
        options: {
          padding: 16,
          ...preventOverflowOptions,
        },
      },
      {
        ...applyMinWidth,
        enabled: openState.isOpen && shouldApplyMinWidth,
      },
      {
        ...applyMaxSize,
        enabled: openState.isOpen,
      },
    ],
    [
      arrowElement,
      arrowOptions,
      flipOptions,
      offset,
      preventOverflowOptions,
      openState.isOpen,
      shouldApplyMinWidth,
    ]
  );
  const {
    styles: popperStyles,
    state: popperState,
    update: popperUpdate,
  } = usePopper(triggerElement, overlayElement, {modifiers, placement: position});

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
  const {overlayProps: overlayAriaProps} = useOverlayAria(
    {
      onClose: () => {
        onClose?.();

        if (interactedOutside.current) {
          onInteractOutside?.();
          interactedOutside.current = false;
          const trigger = interactOutsideTrigger.current;
          interactOutsideTrigger.current = null;

          requestAnimationFrame(() => {
            trigger?.focus();
            trigger?.click();
          });
        }

        openState.close();
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
          (shouldCloseOnInteractOutside?.(target) ?? true)
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
    update: popperUpdate,
    triggerRef,
    triggerProps: {
      ref: setTriggerElement,
      ...triggerAriaProps,
    },
    overlayRef,
    overlayProps: {
      ref: setOverlayElement,
      style: popperStyles.popper,
      ...mergeProps(overlayTriggerAriaProps, overlayAriaProps),
    },
    arrowProps: {
      ref: setArrowElement,
      style: popperStyles.arrow,
      placement: popperState?.placement,
    },
  };
}

export default useOverlay;
