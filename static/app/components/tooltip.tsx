import {cloneElement, Fragment, isValidElement, useMemo, useRef, useState} from 'react';
import {createPortal} from 'react-dom';
import {Manager, Popper, PopperArrowProps, PopperProps, Reference} from 'react-popper';
import {SerializedStyles} from '@emotion/react';
import styled from '@emotion/styled';
import {AnimatePresence, motion, MotionStyle} from 'framer-motion';
import * as PopperJS from 'popper.js';

import space from 'sentry/styles/space';
import domId from 'sentry/utils/domId';
import testableTransition from 'sentry/utils/testableTransition';

import {IS_ACCEPTANCE_TEST} from '../constants/index';

import {AcceptanceTestTooltip} from './acceptanceTestTooltip';

export const OPEN_DELAY = 50;

/**
 * How long to wait before closing the tooltip when isHoverable is set
 */
const CLOSE_DELAY = 50;
export interface TooltipProps {
  children: React.ReactNode;
  /**
   * The content to show in the tooltip popover
   */
  title: React.ReactNode;

  className?: string;

  /**
   * Display mode for the container element
   */
  containerDisplayMode?: React.CSSProperties['display'];

  /**
   * Time to wait (in milliseconds) before showing the tooltip
   */
  delay?: number;

  /**
   * Disable the tooltip display entirely
   */
  disabled?: boolean;

  /**
   * Force the tooltip to be visible without hovering
   */
  forceShow?: boolean;

  /**
   * If true, user is able to hover tooltip without it disappearing.
   * (nice if you want to be able to copy tooltip contents to clipboard)
   */
  isHoverable?: boolean;

  /**
   * Additional style rules for the tooltip content.
   */
  popperStyle?: React.CSSProperties | SerializedStyles;

  /**
   * Position for the tooltip.
   */
  position?: PopperJS.Placement;

  /**
   * Only display the tooltip only if the content overflows
   */
  showOnlyOnOverflow?: boolean;

  /**
   * If child node supports ref forwarding, you can skip apply a wrapper
   */
  skipWrapper?: boolean;
}

/**
 * Used to compute the transform origin to give the scale-down micro-animation
 * a pleasant feeling. Without this the animation can feel somewhat 'wrong'.
 */
function computeOriginFromArrow(
  placement: PopperProps['placement'],
  arrowProps: PopperArrowProps
): MotionStyle {
  // XXX: Bottom means the arrow will be pointing up
  switch (placement) {
    case 'top':
      return {originX: `${arrowProps.style.left}px`, originY: '100%'};
    case 'bottom':
      return {originX: `${arrowProps.style.left}px`, originY: 0};
    case 'left':
      return {originX: '100%', originY: `${arrowProps.style.top}px`};
    case 'right':
      return {originX: 0, originY: `${arrowProps.style.top}px`};
    default:
      return {originX: `50%`, originY: '100%'};
  }
}

function isOverflown(el: Element): boolean {
  return el.scrollWidth > el.clientWidth || Array.from(el.children).some(isOverflown);
}

// Warning: This component is conditionally exported end-of-file based on IS_ACCEPTANCE_TEST env variable
export function DO_NOT_USE_TOOLTIP({
  children,
  className,
  delay,
  forceShow,
  isHoverable,
  popperStyle,
  showOnlyOnOverflow,
  skipWrapper,
  title,
  disabled = false,
  position = 'top',
  containerDisplayMode = 'inline-block',
}: TooltipProps) {
  const [isOpen, setOpen] = useState(false);

  // Tooltip ID is stable accross renders
  const tooltipId = useMemo(() => domId('tooltip-'), []);

  // Delayed open and close time handles
  const delayOpenTimeoutRef = useRef<number | null>(null);
  const delayHideTimeoutRef = useRef<number | null>(null);

  // When the component is unmounted, make sure to stop the timeouts
  useEffect(
    () => () => {
      if (delayOpenTimeoutRef.current) {
        window.clearTimeout(delayOpenTimeoutRef.current);
      }
      if (delayHideTimeoutRef.current) {
        window.clearTimeout(delayHideTimeoutRef.current);
      }
    },
    []
  );

  // Tracks the triggering element
  const triggerRef = useRef<HTMLElement | null>(null);
  const modifiers: PopperJS.Modifiers = useMemo(() => {
    return {
      hide: {enabled: false},
      preventOverflow: {
        padding: 10,
        enabled: true,
        boundariesElement: 'viewport',
      },
      applyStyle: {
        gpuAcceleration: true,
      },
    };
  }, []);

  function handleOpen() {
    if (triggerRef.current && showOnlyOnOverflow && !isOverflown(triggerRef.current)) {
      return;
    }

    if (delayHideTimeoutRef.current) {
      window.clearTimeout(delayHideTimeoutRef.current);
      delayHideTimeoutRef.current = null;
    }

    if (delay === 0) {
      setOpen(true);
      return;
    }

    delayOpenTimeoutRef.current = window.setTimeout(
      () => setOpen(true),
      delay ?? OPEN_DELAY
    );
  }

  function handleClose() {
    if (delayOpenTimeoutRef.current) {
      window.clearTimeout(delayOpenTimeoutRef.current);
      delayOpenTimeoutRef.current = null;
    }

    if (isHoverable) {
      delayHideTimeoutRef.current = window.setTimeout(() => setOpen(false), CLOSE_DELAY);
    } else {
      setOpen(false);
    }
  }

  function renderTrigger(triggerChildren: React.ReactNode, ref: React.Ref<HTMLElement>) {
    const propList: Partial<React.ComponentProps<typeof Container>> = {
      'aria-describedby': tooltipId,
      onFocus: handleOpen,
      onBlur: handleClose,
      onPointerEnter: handleOpen,
      onPointerLeave: handleClose,
    };

    const setRef = (el: HTMLElement) => {
      if (typeof ref === 'function') {
        ref(el);
      }
      triggerRef.current = el;
    };

    // Use the `type` property of the react instance to detect whether we have
    // a basic element (type=string) or a class/function component
    // (type=function or object). Because we can't rely on the child element
    // implementing forwardRefs we wrap it with a span tag for the ref

    if (
      isValidElement(triggerChildren) &&
      (skipWrapper || typeof triggerChildren.type === 'string')
    ) {
      // Basic DOM nodes can be cloned and have more props applied.
      return cloneElement(triggerChildren, {...propList, ref: setRef});
    }

    propList.containerDisplayMode = containerDisplayMode;

    return (
      <Container {...propList} className={className} ref={setRef}>
        {triggerChildren}
      </Container>
    );
  }

  if (disabled || !title) {
    return <Fragment>{children}</Fragment>;
  }

  return (
    <Manager>
      <Reference>{({ref}) => renderTrigger(children, ref)}</Reference>
      {createPortal(
        <AnimatePresence>
          {forceShow || isOpen ? (
            <Popper placement={position} modifiers={modifiers}>
              {({ref, style, placement, arrowProps}) => (
                <PositionWrapper style={style}>
                  <TooltipContent
                    id={tooltipId}
                    initial={{opacity: 0}}
                    animate={{
                      opacity: 1,
                      scale: 1,
                      transition: testableTransition({
                        type: 'linear',
                        ease: [0.5, 1, 0.89, 1],
                        duration: 0.2,
                      }),
                    }}
                    exit={{
                      opacity: 0,
                      scale: 0.95,
                      transition: testableTransition({type: 'spring', delay: 0.1}),
                    }}
                    style={computeOriginFromArrow(position, arrowProps)}
                    transition={{duration: 0.2}}
                    className="tooltip-content"
                    aria-hidden={false}
                    ref={ref}
                    data-placement={placement}
                    popperStyle={popperStyle}
                    onMouseEnter={() => isHoverable && handleOpen()}
                    onMouseLeave={() => isHoverable && handleClose()}
                  >
                    {title}
                    <TooltipArrow
                      ref={arrowProps.ref}
                      data-placement={placement}
                      style={arrowProps.style}
                    />
                  </TooltipContent>
                </PositionWrapper>
              )}
            </Popper>
          ) : null}
        </AnimatePresence>,
        document.body
      )}
    </Manager>
  );
}

// Using an inline-block solves the container being smaller
// than the elements it is wrapping
const Container = styled('span')<{
  containerDisplayMode?: React.CSSProperties['display'];
}>`
  ${p => p.containerDisplayMode && `display: ${p.containerDisplayMode}`};
  max-width: 100%;
`;

const PositionWrapper = styled('div')`
  z-index: ${p => p.theme.zIndex.tooltip};
`;

const TooltipContent = styled(motion.div)<{popperStyle: TooltipProps['popperStyle']}>`
  will-change: transform, opacity;
  position: relative;
  background: ${p => p.theme.backgroundElevated};
  padding: ${space(1)} ${space(1.5)};
  border-radius: ${p => p.theme.borderRadius};
  box-shadow: 0 0 0 1px ${p => p.theme.translucentBorder}, ${p => p.theme.dropShadowHeavy};
  overflow-wrap: break-word;
  max-width: 225px;

  color: ${p => p.theme.textColor};
  font-size: ${p => p.theme.fontSizeSmall};
  line-height: 1.2;

  margin: 6px;
  text-align: center;
  ${p => p.popperStyle as any};
`;

const TooltipArrow = styled('span')`
  position: absolute;
  width: 6px;
  height: 6px;
  border: solid 6px transparent;
  pointer-events: none;

  &::before {
    content: '';
    display: block;
    position: absolute;
    width: 0;
    height: 0;
    border: solid 6px transparent;
    z-index: -1;
  }

  &[data-placement*='bottom'] {
    top: 0;
    margin-top: -12px;
    border-bottom-color: ${p => p.theme.backgroundElevated};
    &::before {
      bottom: -5px;
      left: -6px;
      border-bottom-color: ${p => p.theme.translucentBorder};
    }
  }

  &[data-placement*='top'] {
    bottom: 0;
    margin-bottom: -12px;
    border-top-color: ${p => p.theme.backgroundElevated};
    &::before {
      top: -5px;
      left: -6px;
      border-top-color: ${p => p.theme.translucentBorder};
    }
  }

  &[data-placement*='right'] {
    left: 0;
    margin-left: -12px;
    border-right-color: ${p => p.theme.backgroundElevated};
    &::before {
      top: -6px;
      right: -5px;
      border-right-color: ${p => p.theme.translucentBorder};
    }
  }

  &[data-placement*='left'] {
    right: 0;
    margin-right: -12px;
    border-left-color: ${p => p.theme.backgroundElevated};
    &::before {
      top: -6px;
      left: -5px;
      border-left-color: ${p => p.theme.translucentBorder};
    }
  }
`;

interface AcceptanceTestTooltipProxyProps extends TooltipProps {
  /**
   * Stops tooltip from being opened during tooltip visual acceptance.
   * Should be set to true if tooltip contains unisolated data (eg. dates)
   */
  disableForVisualTest?: boolean;
}

/**
 * AcceptanceTestTooltipProxy will enhance the regular tooltip with the open/close
 * functionality used in src/sentry/utils/pytest/selenium.py so that tooltips
 * can be opened and closed for specific snapshots.
 */
function Tooltip({disableForVisualTest, ...props}: AcceptanceTestTooltipProxyProps) {
  if (IS_ACCEPTANCE_TEST) {
    return disableForVisualTest ? (
      <Fragment>{props.children}</Fragment>
    ) : (
      <AcceptanceTestTooltip {...props} />
    );
  }

  return <DO_NOT_USE_TOOLTIP {...props} />;
}

// Rename for better language support
export default Tooltip;
