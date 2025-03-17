import {
  cloneElement,
  isValidElement,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type {PopperProps} from 'react-popper';
import {usePopper} from 'react-popper';
import {useTheme} from '@emotion/react';

import domId from 'sentry/utils/domId';
import type {ColorOrAlias} from 'sentry/utils/theme';

function makeDefaultPopperModifiers(arrowElement: HTMLElement | null, offset: number) {
  return [
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
        padding: 12,
        altAxis: true,
      },
    },
  ];
}

/**
 * How long to wait before opening the overlay
 */
const OPEN_DELAY = 50;

/**
 * How long to wait before closing the overlay when isHoverable is set
 */
const CLOSE_DELAY = 50;

interface UseHoverOverlayProps {
  /**
   * className for when a wrapper is used. Does nothing using skipWrapper.
   */
  className?: string;
  /**
   * Display mode for the container element. Does nothing using skipWrapper.
   */
  containerDisplayMode?: React.CSSProperties['display'];
  /**
   * Time to wait (in milliseconds) before showing the overlay
   */
  delay?: number;
  /**
   * Time in ms until overlay is hidden. When used with isHoverable this is
   * used as the time allowed for the user to move their cursor into the overlay)
   */
  displayTimeout?: number;
  /**
   * Force the overlay to be visible without hovering
   */
  forceVisible?: boolean;
  /**
   * If true, user is able to hover overlay without it disappearing. (nice if
   * you want the overlay to be interactive)
   */
  isHoverable?: boolean;
  /**
   * Offset along the main axis.
   */
  offset?: number;
  /**
   * Callback whenever the hovercard is blurred
   * See also `onHover`
   */
  onBlur?: () => void;

  /**
   * Callback whenever the hovercard is hovered
   * See also `onBlur`
   */
  onHover?: () => void;

  /**
   * Position for the overlay.
   */
  position?: PopperProps<any>['placement'];

  /**
   * Only display the overlay only if the content overflows
   */
  showOnlyOnOverflow?: boolean;
  /**
   * Whether to add a dotted underline to the trigger element, to indicate the
   * presence of a overlay.
   */
  showUnderline?: boolean;
  /**
   * If child node supports ref forwarding, you can skip apply a wrapper
   */
  skipWrapper?: boolean;
  /**
   * style for when a wrapper is used. Does nothing using skipWrapper.
   */
  style?: React.CSSProperties;

  /**
   * Color of the dotted underline, if available. See also: showUnderline.
   */
  underlineColor?: ColorOrAlias;
}

function isOverflown(el: Element): boolean {
  // Safari seems to calculate scrollWidth incorrectly, causing isOverflown to always return true in some cases.
  // Adding a 2 pixel tolerance seems to account for this discrepancy.
  const tolerance =
    navigator.userAgent.includes('Safari') && !navigator.userAgent.includes('Chrome')
      ? 2
      : 0;
  return (
    el.scrollWidth - el.clientWidth > tolerance ||
    Array.from(el.children).some(isOverflown)
  );
}

function maybeClearRefTimeout(ref: React.MutableRefObject<number | undefined>) {
  if (typeof ref.current === 'number') {
    window.clearTimeout(ref.current);
    ref.current = undefined;
  }
}

/**
 * A hook used to trigger a positioned overlay on hover.
 */
function useHoverOverlay(
  overlayType: string,
  {
    className,
    style,
    delay,
    displayTimeout,
    isHoverable,
    showUnderline,
    underlineColor,
    showOnlyOnOverflow,
    skipWrapper,
    forceVisible,
    offset = 8,
    position = 'top',
    containerDisplayMode = 'inline-block',
    onHover,
    onBlur,
  }: UseHoverOverlayProps
) {
  const theme = useTheme();
  const describeById = useMemo(() => domId(`${overlayType}-`), [overlayType]);

  const [isVisible, setIsVisible] = useState(forceVisible ?? false);
  const isOpen = forceVisible ?? isVisible;

  useEffect(() => {
    if (isOpen) {
      onHover?.();
    } else {
      onBlur?.();
    }
  }, [isOpen, onBlur, onHover]);

  const [triggerElement, setTriggerElement] = useState<HTMLElement | null>(null);
  const [overlayElement, setOverlayElement] = useState<HTMLElement | null>(null);
  const [arrowElement, setArrowElement] = useState<HTMLElement | null>(null);

  const modifiers = useMemo(
    () => makeDefaultPopperModifiers(arrowElement, offset),
    [arrowElement, offset]
  );

  const {styles, state, update} = usePopper(triggerElement, overlayElement, {
    modifiers,
    placement: position,
  });

  // Delayed open and close time handles
  const delayOpenTimeoutRef = useRef<number | undefined>(undefined);
  const delayHideTimeoutRef = useRef<number | undefined>(undefined);

  // When the component is unmounted, make sure to stop the timeouts
  // No need to reset value of refs to undefined since they will be garbage collected anyways
  useEffect(() => {
    return () => {
      maybeClearRefTimeout(delayHideTimeoutRef);
      maybeClearRefTimeout(delayOpenTimeoutRef);
    };
  }, []);

  const handleMouseEnter = useCallback(() => {
    // Do nothing if showOnlyOnOverflow and we're not overflowing.
    if (showOnlyOnOverflow && triggerElement && !isOverflown(triggerElement)) {
      return;
    }

    maybeClearRefTimeout(delayHideTimeoutRef);
    maybeClearRefTimeout(delayOpenTimeoutRef);

    if (delay === 0) {
      setIsVisible(true);
      return;
    }

    delayOpenTimeoutRef.current = window.setTimeout(
      () => setIsVisible(true),
      delay ?? OPEN_DELAY
    );
  }, [delay, showOnlyOnOverflow, triggerElement]);

  const handleMouseLeave = useCallback(() => {
    maybeClearRefTimeout(delayHideTimeoutRef);
    maybeClearRefTimeout(delayOpenTimeoutRef);

    if (!isHoverable && !displayTimeout) {
      setIsVisible(false);
      return;
    }

    delayHideTimeoutRef.current = window.setTimeout(() => {
      setIsVisible(false);
    }, displayTimeout ?? CLOSE_DELAY);
  }, [isHoverable, displayTimeout]);

  /**
   * Wraps the passed in react elements with a container that has the proper
   * event handlers to trigger the overlay.
   *
   * If skipWrapper is used the passed element will be cloned and the events
   * will be assigned to that element.
   */
  const wrapTrigger = useCallback(
    (triggerChildren: React.ReactNode) => {
      const props = {
        'aria-describedby': describeById,
        ref: setTriggerElement,
        onFocus: handleMouseEnter,
        onBlur: handleMouseLeave,
        onPointerEnter: handleMouseEnter,
        onPointerLeave: handleMouseLeave,
      };

      // Use the `type` property of the react instance to detect whether we have
      // a basic element (type=string) or a class/function component
      // (type=function or object). Because we can't rely on the child element
      // implementing forwardRefs we wrap it with a span tag for the ref
      if (
        isValidElement(triggerChildren) &&
        (skipWrapper || typeof triggerChildren.type === 'string')
      ) {
        if (showUnderline) {
          const triggerStyle = {
            ...triggerChildren.props.style,
            ...theme.tooltipUnderline(underlineColor),
          };

          return cloneElement<any>(
            triggerChildren,
            Object.assign(props, {style: triggerStyle})
          );
        }

        // Basic DOM nodes can be cloned and have more props applied.
        return cloneElement<any>(
          triggerChildren,
          Object.assign(props, {
            style: triggerChildren.props.style,
          })
        );
      }

      const containerProps = Object.assign(props, {
        style: {
          ...(showUnderline ? theme.tooltipUnderline(underlineColor) : {}),
          ...(containerDisplayMode ? {display: containerDisplayMode} : {}),
          maxWidth: '100%',
          ...style,
        },
        className,
      });

      // Using an inline-block solves the container being smaller
      // than the elements it is wrapping
      return <span {...containerProps}>{triggerChildren}</span>;
    },
    [
      className,
      containerDisplayMode,
      handleMouseEnter,
      handleMouseLeave,
      showUnderline,
      skipWrapper,
      describeById,
      style,
      theme,
      underlineColor,
    ]
  );

  const reset = useCallback(() => {
    setIsVisible(false);
    maybeClearRefTimeout(delayHideTimeoutRef);
    maybeClearRefTimeout(delayOpenTimeoutRef);
  }, []);

  const overlayProps = useMemo(() => {
    return {
      id: describeById,
      ref: setOverlayElement,
      style: styles.popper,
      onMouseEnter: isHoverable ? handleMouseEnter : undefined,
      onMouseLeave: isHoverable ? handleMouseLeave : undefined,
    };
  }, [
    describeById,
    setOverlayElement,
    styles.popper,
    isHoverable,
    handleMouseEnter,
    handleMouseLeave,
  ]);

  const arrowProps = useMemo(() => {
    return {
      ref: setArrowElement,
      style: styles.arrow,
      placement: state?.placement,
    };
  }, [setArrowElement, styles.arrow, state?.placement]);

  return {
    wrapTrigger,
    isOpen,
    overlayProps,
    arrowProps,
    placement: state?.placement,
    arrowData: state?.modifiersData?.arrow,
    update,
    reset,
  };
}

export type {UseHoverOverlayProps};
export {useHoverOverlay};
