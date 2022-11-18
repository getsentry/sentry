import {useMemo, useState} from 'react';
import {PopperProps, usePopper} from 'react-popper';
import {detectOverflow, Modifier, preventOverflow} from '@popperjs/core';
import {useButton} from '@react-aria/button';
import {
  OverlayProps,
  OverlayTriggerProps,
  useOverlay as useAriaOverlay,
  useOverlayTrigger,
} from '@react-aria/overlays';
import {mergeProps} from '@react-aria/utils';
import {useOverlayTriggerState} from '@react-stately/overlays';
import {OverlayTriggerProps as OverlayTriggerStateProps} from '@react-types/overlays';

type PreventOverflowOptions = NonNullable<typeof preventOverflow['options']>;

/**
 * PopperJS modifier to change the popper element's width/height to prevent
 * overflowing. Based on
 * https://github.com/atomiks/popper.js/blob/master/src/modifiers/maxSize.js
 */
const maxSize: Modifier<'maxSize', PreventOverflowOptions> = {
  name: 'maxSize',
  enabled: true,
  phase: 'main',
  requiresIfExists: ['offset', 'preventOverflow', 'flip'],
  fn({state, name, options}) {
    const overflow = detectOverflow(state, options);
    const {x, y} = state.modifiersData.preventOverflow ?? {x: 0, y: 0};
    const {width, height} = state.rects.popper;
    const [basePlacement] = state.placement.split('-');

    const widthSide = basePlacement === 'left' ? 'left' : 'right';
    const heightSide = basePlacement === 'top' ? 'top' : 'bottom';

    const flippedWidthSide = basePlacement === 'left' ? 'right' : 'left';
    const flippedHeightSide = basePlacement === 'top' ? 'bottom' : 'top';

    // If there is enough space on the other side, then allow the popper to flip
    // without constraining its size
    const maxHeight = Math.max(
      height - overflow[heightSide] - y,
      -overflow[flippedHeightSide]
    );

    // If there is enough space on the other side, then allow the popper to flip
    // without constraining its size
    const maxWidth = Math.max(
      width - overflow[widthSide] - x,
      -overflow[flippedWidthSide]
    );

    state.modifiersData[name] = {
      width: maxWidth,
      height: maxHeight,
    };
  },
};

const applyMaxSize: Modifier<'applyMaxSize', {}> = {
  name: 'applyMaxSize',
  enabled: true,
  phase: 'beforeWrite',
  requires: ['maxSize'],
  fn({state}) {
    const {width, height} = state.modifiersData.maxSize;
    state.styles.popper.maxHeight = height;
    state.styles.popper.maxWidth = width;
  },
};

export interface UseOverlayProps
  extends Partial<OverlayProps>,
    Partial<OverlayTriggerProps>,
    Partial<OverlayTriggerStateProps> {
  /**
   * Offset along the main axis.
   */
  offset?: number;
  /**
   * Position for the overlay.
   */
  position?: PopperProps<any>['placement'];
  preventOverflowOptions?: PreventOverflowOptions;
}

function useOverlay({
  isOpen,
  onClose,
  defaultOpen,
  onOpenChange,
  type = 'dialog',
  offset = 8,
  position = 'top',
  preventOverflowOptions = {},
  isDismissable = true,
  shouldCloseOnBlur = false,
  isKeyboardDismissDisabled,
  shouldCloseOnInteractOutside,
}: UseOverlayProps = {}) {
  // Callback refs for react-popper
  const [triggerElement, setTriggerElement] = useState<HTMLButtonElement | null>(null);
  const [overlayElement, setOverlayElement] = useState<HTMLDivElement | null>(null);
  const [arrowElement, setArrowElement] = useState<HTMLDivElement | null>(null);

  // Ref objects for react-aria (useOverlayTrigger & useOverlay)
  const triggerRef = useMemo(() => ({current: triggerElement}), [triggerElement]);
  const overlayRef = useMemo(() => ({current: overlayElement}), [overlayElement]);

  // Get props for trigger button
  const openState = useOverlayTriggerState({isOpen, defaultOpen, onOpenChange});
  const {buttonProps} = useButton({onPress: openState.open}, triggerRef);
  const {triggerProps, overlayProps: overlayTriggerProps} = useOverlayTrigger(
    {type},
    openState,
    triggerRef
  );

  // Get props for overlay element
  const {overlayProps} = useAriaOverlay(
    {
      onClose: () => {
        onClose?.();
        openState.close();
      },
      isOpen: openState.isOpen,
      isDismissable,
      shouldCloseOnBlur,
      isKeyboardDismissDisabled,
      shouldCloseOnInteractOutside,
    },
    overlayRef
  );

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
        },
      },
      {
        name: 'offset',
        options: {
          offset: [0, offset],
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
        options: {
          padding: 16,
          ...preventOverflowOptions,
        },
      },
      applyMaxSize,
    ],
    [arrowElement, offset, preventOverflowOptions]
  );
  const {styles: popperStyles, state: popperState} = usePopper(
    triggerElement,
    overlayElement,
    {modifiers, placement: position}
  );

  return {
    isOpen: openState.isOpen,
    state: openState,
    triggerRef,
    triggerProps: {
      ref: setTriggerElement,
      ...mergeProps(buttonProps, triggerProps),
    },
    overlayRef,
    overlayProps: {
      ref: setOverlayElement,
      style: popperStyles.popper,
      ...mergeProps(overlayTriggerProps, overlayProps),
    },
    arrowProps: {
      ref: setArrowElement,
      style: popperStyles.arrow,
      placement: popperState?.placement,
    },
  };
}

export default useOverlay;
