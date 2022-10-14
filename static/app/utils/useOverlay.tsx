import {useMemo, useState} from 'react';
import {PopperProps, usePopper} from 'react-popper';
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
}

function useOverlay({
  isOpen,
  onClose,
  defaultOpen,
  onOpenChange,
  type = 'dialog',
  offset = 8,
  position = 'top',
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
          altAxis: true,
        },
      },
    ],
    [arrowElement, offset]
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
