import {
  cloneElement,
  Fragment,
  isValidElement,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react';
import {createPortal} from 'react-dom';
import type {SerializedStyles} from '@emotion/react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import {
  arrow,
  flip,
  offset,
  shift,
  useFloating,
  useHover,
  useInteractions,
} from '@floating-ui/react';
import {AnimatePresence} from 'framer-motion';

import {Overlay, PositionWrapper} from 'sentry/components/overlay';
import {space} from 'sentry/styles/space';
import type {UseHoverOverlayProps} from 'sentry/utils/useHoverOverlay';

interface TooltipProps extends UseHoverOverlayProps {
  /**
   * The content to show in the tooltip popover
   */
  title: React.ReactNode;
  children?: React.ReactNode;
  /**
   * Disable the tooltip display entirely
   */
  disabled?: boolean;
  /**
   * Additional style rules for the tooltip content.
   */
  overlayStyle?: React.CSSProperties | SerializedStyles;
}

function Tooltip({
  children,
  overlayStyle,
  title,
  disabled = false,
  skipWrapper,
  showUnderline,
  underlineColor,
  containerDisplayMode,
  className,
  offset: offsetValue,
}: TooltipProps) {
  const theme = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const arrowRef = useRef(null);
  const describeById = useId();

  const {refs, floatingStyles, context, middlewareData, placement} = useFloating({
    open: isOpen,
    onOpenChange: setIsOpen,
    placement: 'top',
    middleware: [
      flip(),
      arrow({
        element: arrowRef,
        // Set padding to avoid the arrow reaching the side of the tooltip
        // and overflowing out of the rounded border
        padding: 4,
      }),
      offset(offsetValue ?? 8),
      shift(),
    ],
    // whileElementsMounted: autoUpdate,
  });

  const hover = useHover(context);

  const {getReferenceProps, getFloatingProps} = useInteractions([hover]);

  // Reset the visibility when the tooltip becomes disabled
  useEffect(() => {
    if (disabled) {
      setIsOpen(false);
    }
  }, [setIsOpen, disabled]);

  /**
   * Wraps the passed in react elements with a container that has the proper
   * event handlers to trigger the overlay.
   *
   * If skipWrapper is used the passed element will be cloned and the events
   * will be assigned to that element.
   */
  const wrappedTrigger = useMemo(() => {
    const triggerChildren = children;
    const props = {
      'aria-describedby': describeById,
      ref: refs.setReference,
      // onFocus: handleMouseEnter,
      // onBlur: handleMouseLeave,
      // onPointerEnter: handleMouseEnter,
      // onPointerLeave: handleMouseLeave,
      ...getReferenceProps(),
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
      },
      className,
    });

    // Using an inline-block solves the container being smaller
    // than the elements it is wrapping
    return <span {...containerProps}>{triggerChildren}</span>;
  }, [
    children,
    describeById,
    refs.setReference,
    getReferenceProps,
    skipWrapper,
    showUnderline,
    theme,
    underlineColor,
    containerDisplayMode,
    className,
  ]);

  if (disabled || !title) {
    return <Fragment>{children}</Fragment>;
  }

  const tooltipContent = isOpen && (
    <PositionWrapper
      ref={refs.setFloating}
      id={describeById}
      zIndex={theme.zIndex.tooltip}
      style={floatingStyles}
      {...getFloatingProps()}
    >
      <TooltipContent
        animated
        arrowProps={{
          ref: arrowRef,
          placement,
          style: {
            position: 'absolute',
            left: middlewareData.arrow?.x,
            top: middlewareData.arrow?.y,
          },
        }}
        originPoint={{
          x: middlewareData.arrow?.x,
          y: middlewareData.arrow?.y,
        }}
        placement={placement}
        overlayStyle={overlayStyle}
      >
        {title}
      </TooltipContent>
    </PositionWrapper>
  );

  return (
    <Fragment>
      {wrappedTrigger}
      {createPortal(<AnimatePresence>{tooltipContent}</AnimatePresence>, document.body)}
    </Fragment>
  );
}

const TooltipContent = styled(Overlay)`
  padding: ${space(1)} ${space(1.5)};
  overflow-wrap: break-word;
  max-width: 225px;
  color: ${p => p.theme.textColor};
  font-size: ${p => p.theme.fontSizeSmall};
  line-height: 1.2;
  text-align: center;
`;

export type {TooltipProps};
export {Tooltip};
