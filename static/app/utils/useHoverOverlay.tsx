import {
  cloneElement,
  isValidElement,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {PopperProps, usePopper} from 'react-popper';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import domId from 'sentry/utils/domId';
import {ColorOrAlias} from 'sentry/utils/theme';

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
   * Color of the dotted underline, if available. See also: showUnderline.
   */
  underlineColor?: ColorOrAlias;
}

function isOverflown(el: Element): boolean {
  return el.scrollWidth > el.clientWidth || Array.from(el.children).some(isOverflown);
}

/**
 * A hook used to trigger a positioned overlay on hover.
 */
function useHoverOverlay(
  overlayType: string,
  {
    className,
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
  }: UseHoverOverlayProps
) {
  const [isVisible, setVisible] = useState(false);
  const describeById = useMemo(() => domId(`${overlayType}-`), [overlayType]);
  const theme = useTheme();

  const isOpen = forceVisible ?? isVisible;

  const [triggerElement, setTriggerElement] = useState<HTMLElement | null>(null);
  const [overlayElement, setOverlayElement] = useState<HTMLElement | null>(null);
  const [arrowElement, setArrowElement] = useState<HTMLElement | null>(null);

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
          padding: 12,
          altAxis: true,
        },
      },
    ],
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
  useEffect(() => {
    return () => {
      window.clearTimeout(delayOpenTimeoutRef.current);
      window.clearTimeout(delayHideTimeoutRef.current);
    };
  }, []);

  const handleMouseEnter = useCallback(() => {
    // Do nothing if showOnlyOnOverflow and we're not overflowing.
    if (showOnlyOnOverflow && triggerElement && !isOverflown(triggerElement)) {
      return;
    }

    window.clearTimeout(delayHideTimeoutRef.current);
    window.clearTimeout(delayOpenTimeoutRef.current);

    if (delay === 0) {
      setVisible(true);
      return;
    }

    delayOpenTimeoutRef.current = window.setTimeout(
      () => setVisible(true),
      delay ?? OPEN_DELAY
    );
  }, [delay, showOnlyOnOverflow, triggerElement]);

  const handleMouseLeave = useCallback(() => {
    window.clearTimeout(delayOpenTimeoutRef.current);
    window.clearTimeout(delayHideTimeoutRef.current);

    if (!isHoverable && !displayTimeout) {
      setVisible(false);
      return;
    }

    delayHideTimeoutRef.current = window.setTimeout(
      () => setVisible(false),
      displayTimeout ?? CLOSE_DELAY
    );
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
        const triggerStyle = {
          ...triggerChildren.props.style,
          ...(showUnderline && theme.tooltipUnderline(underlineColor)),
        };

        // Basic DOM nodes can be cloned and have more props applied.
        return cloneElement<any>(triggerChildren, {...props, style: triggerStyle});
      }

      const ourContainerProps = {
        ...props,
        containerDisplayMode,
        style: showUnderline ? theme.tooltipUnderline(underlineColor) : undefined,
        className,
      };

      return <Container {...ourContainerProps}>{triggerChildren}</Container>;
    },
    [
      className,
      containerDisplayMode,
      handleMouseEnter,
      handleMouseLeave,
      showUnderline,
      skipWrapper,
      describeById,
      theme,
      underlineColor,
    ]
  );

  const overlayProps = {
    id: describeById,
    ref: setOverlayElement,
    style: styles.popper,
    onMouseEnter: isHoverable ? handleMouseEnter : undefined,
    onMouseLeave: isHoverable ? handleMouseLeave : undefined,
  };

  const arrowProps = {
    ref: setArrowElement,
    style: styles.arrow,
    placement: state?.placement,
  };

  return {
    wrapTrigger,
    isOpen,
    overlayProps,
    arrowProps,
    placement: state?.placement,
    arrowData: state?.modifiersData?.arrow,
    update,
  };
}

// Using an inline-block solves the container being smaller
// than the elements it is wrapping
const Container = styled('span')<{containerDisplayMode: React.CSSProperties['display']}>`
  ${p => p.containerDisplayMode && `display: ${p.containerDisplayMode}`};
  max-width: 100%;
`;

export {useHoverOverlay, UseHoverOverlayProps};
