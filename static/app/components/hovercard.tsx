import * as React from 'react';
import ReactDOM from 'react-dom';
import {Manager, Popper, PopperProps, Reference} from 'react-popper';
import styled from '@emotion/styled';
import classNames from 'classnames';
import {motion} from 'framer-motion';

import space from 'sentry/styles/space';
import {domId} from 'sentry/utils/domId';

export const HOVERCARD_PORTAL_ID = 'hovercard-portal';

function findOrCreatePortal(): HTMLElement {
  let portal = document.getElementById(HOVERCARD_PORTAL_ID);

  if (portal) {
    return portal;
  }

  portal = document.createElement('div');
  portal.setAttribute('id', HOVERCARD_PORTAL_ID);
  document.body.appendChild(portal);

  return portal;
}

interface HovercardProps {
  /**
   * Classname to apply to the hovercard
   */
  children: React.ReactNode;
  /**
   * Element to display in the body
   */
  body?: React.ReactNode;
  /**
   * Classname to apply to body container
   */
  bodyClassName?: string;
  className?: string;
  /**
   * Classname to apply to the hovercard container
   */
  containerClassName?: string;
  /**
   * Time in ms until hovercard is hidden
   */
  displayTimeout?: number;
  /**
   * Element to display in the header
   */
  header?: React.ReactNode;
  /**
   * Popper Modifiers
   */
  modifiers?: PopperProps['modifiers'];
  /**
   * Offset for the arrow
   */
  offset?: string;
  /**
   * Position tooltip should take relative to the child element
   */
  position?: PopperProps['placement'];
  /**
   * If set, is used INSTEAD OF the hover action to determine whether the hovercard is shown
   */
  show?: boolean;
  /**
   * Color of the arrow tip border
   */
  tipBorderColor?: string;
  /**
   * Color of the arrow tip
   */
  tipColor?: string;
}

function Hovercard(props: HovercardProps): React.ReactElement {
  const [visible, setVisible] = React.useState(false);

  const inTimeout = React.useRef<number | null>(null);
  const scheduleUpdateRef = React.useRef<(() => void) | null>(null);

  const portalEl = React.useMemo(() => findOrCreatePortal(), []);
  const tooltipId = React.useMemo(() => domId('hovercard-'), []);

  React.useEffect(() => {
    // We had a problem with popper not recalculating position when body/header changed while hovercard still opened.
    // This can happen for example when showing a loading spinner in a hovercard and then changing it to the actual content once fetch finishes.
    if (scheduleUpdateRef.current) {
      scheduleUpdateRef.current();
    }
  }, [props.body, props.header]);

  const toggleHovercard = React.useCallback(
    (value: boolean) => {
      // If a previous timeout is set, then clear it
      if (typeof inTimeout.current === 'number') {
        clearTimeout(inTimeout.current);
      }

      // Else enqueue a new timeout
      inTimeout.current = window.setTimeout(
        () => setVisible(value),
        props.displayTimeout ?? 100
      );
    },
    [props.displayTimeout]
  );

  const popperModifiers = React.useMemo(() => {
    const modifiers: PopperProps['modifiers'] = {
      hide: {
        enabled: false,
      },
      preventOverflow: {
        padding: 10,
        enabled: true,
        boundariesElement: 'viewport',
      },
      ...(props.modifiers || {}),
    };
    return modifiers;
  }, [props.modifiers]);

  // If show is not set, then visibility state is uncontrolled
  const isVisible = props.show === undefined ? visible : props.show;

  const hoverProps = React.useMemo((): Pick<
    React.HTMLProps<HTMLDivElement>,
    'onMouseEnter' | 'onMouseLeave'
  > => {
    // If show is not set, then visibility state is controlled by mouse events
    if (props.show === undefined) {
      return {
        onMouseEnter: () => toggleHovercard(true),
        onMouseLeave: () => toggleHovercard(false),
      };
    }
    return {};
  }, [props.show, toggleHovercard]);

  return (
    <Manager>
      <Reference>
        {({ref}) => (
          <span
            ref={ref}
            aria-describedby={tooltipId}
            className={props.containerClassName}
            {...hoverProps}
          >
            {props.children}
          </span>
        )}
      </Reference>
      {ReactDOM.createPortal(
        <Popper placement={props.position ?? 'top'} modifiers={popperModifiers}>
          {({ref, style, placement, arrowProps, scheduleUpdate}) => {
            scheduleUpdateRef.current = scheduleUpdate;

            // Element is not visible in neither controlled and uncontrolled state (show prop is not passed and card is not hovered)
            if (!isVisible) {
              return null;
            }

            // Nothing to render
            if (!props.body && !props.header) {
              return null;
            }

            return (
              <HovercardContainer style={style}>
                <SlideInAnimation visible={isVisible} placement={placement}>
                  <StyledHovercard
                    ref={ref}
                    id={tooltipId}
                    placement={placement}
                    offset={props.offset}
                    // Maintain the hovercard class name for BC with less styles
                    className={classNames('hovercard', props.className)}
                    {...hoverProps}
                  >
                    {props.header ? <Header>{props.header}</Header> : null}
                    {props.body ? (
                      <Body className={props.bodyClassName}>{props.body}</Body>
                    ) : null}
                    <HovercardArrow
                      ref={arrowProps.ref}
                      style={arrowProps.style}
                      placement={placement}
                      tipColor={props.tipColor}
                      tipBorderColor={props.tipBorderColor}
                    />
                  </StyledHovercard>
                </SlideInAnimation>
              </HovercardContainer>
            );
          }}
        </Popper>,
        portalEl
      )}
    </Manager>
  );
}

export {Hovercard};

const SLIDE_DISTANCE = 10;

function SlideInAnimation({
  visible,
  placement,
  children,
}: {
  children: React.ReactNode;
  placement: PopperProps['placement'];
  visible: boolean;
}): React.ReactElement {
  const narrowedPlacement = getTipDirection(placement);

  const x =
    narrowedPlacement === 'left'
      ? [-SLIDE_DISTANCE, 0]
      : narrowedPlacement === 'right'
      ? [SLIDE_DISTANCE, 0]
      : [0, 0];

  const y =
    narrowedPlacement === 'top'
      ? [-SLIDE_DISTANCE, 0]
      : narrowedPlacement === 'bottom'
      ? [SLIDE_DISTANCE, 0]
      : [0, 0];

  return (
    <motion.div
      initial="hidden"
      variants={{
        hidden: {
          opacity: 0,
        },
        visible: {
          opacity: [0, 1],
          x,
          y,
        },
      }}
      animate={visible ? 'visible' : 'hidden'}
      transition={{duration: 0.1, ease: 'easeInOut'}}
    >
      {children}
    </motion.div>
  );
}

function getTipDirection(
  placement: HovercardArrowProps['placement']
): 'top' | 'bottom' | 'left' | 'right' {
  if (!placement) {
    return 'top';
  }

  const prefix = ['top', 'bottom', 'left', 'right'].find(pl => {
    return placement.startsWith(pl);
  });

  return (prefix || 'top') as 'top' | 'bottom' | 'left' | 'right';
}

const HovercardContainer = styled('div')`
  /* Some hovercards overlap the toplevel header and sidebar, and we need to appear on top */
  z-index: ${p => p.theme.zIndex.hovercard};
`;

type StyledHovercardProps = {
  placement: PopperProps['placement'];
  offset?: string;
};

const StyledHovercard = styled('div')<StyledHovercardProps>`
  border-radius: ${p => p.theme.borderRadius};
  text-align: left;
  padding: 0;
  line-height: 1;
  white-space: initial;
  color: ${p => p.theme.textColor};
  border: 1px solid ${p => p.theme.border};
  background: ${p => p.theme.background};
  background-clip: padding-box;
  box-shadow: 0 0 35px 0 rgba(67, 62, 75, 0.2);
  width: 295px;

  /* The hovercard may appear in different contexts, don't inherit fonts */
  font-family: ${p => p.theme.text.family};

  /* Offset for the arrow */
  ${p => (p.placement === 'top' ? `margin-bottom: ${p.offset ?? space(2)}` : '')};
  ${p => (p.placement === 'bottom' ? `margin-top: ${p.offset ?? space(2)}` : '')};
  ${p => (p.placement === 'left' ? `margin-right: ${p.offset ?? space(2)}` : '')};
  ${p => (p.placement === 'right' ? `margin-left: ${p.offset ?? space(2)}` : '')};
`;

const Header = styled('div')`
  font-size: ${p => p.theme.fontSizeMedium};
  background: ${p => p.theme.backgroundSecondary};
  border-bottom: 1px solid ${p => p.theme.border};
  border-radius: ${p => p.theme.borderRadiusTop};
  font-weight: 600;
  word-wrap: break-word;
  padding: ${space(1.5)};
`;

export {Header};

const Body = styled('div')`
  padding: ${space(2)};
  min-height: 30px;
`;

export {Body};

type HovercardArrowProps = {
  placement: PopperProps['placement'];
  tipBorderColor?: string;
  tipColor?: string;
};

const HovercardArrow = styled('span')<HovercardArrowProps>`
  position: absolute;
  width: 20px;
  height: 20px;
  right: ${p => (p.placement === 'left' ? '-3px' : 'auto')};
  left: ${p => (p.placement === 'right' ? '-3px' : 'auto')};
  bottom: ${p => (p.placement === 'top' ? '-3px' : 'auto')};
  top: ${p => (p.placement === 'bottom' ? '-3px' : 'auto')};

  &::before,
  &::after {
    content: '';
    margin: auto;
    position: absolute;
    display: block;
    width: 0;
    height: 0;
    top: 0;
    left: 0;
  }

  /* before element is the hairline border, it is repositioned for each orientation */
  &::before {
    top: 1px;
    border: 10px solid transparent;
    border-${p => getTipDirection(p.placement)}-color:
      ${p => p.tipBorderColor || p.tipColor || p.theme.border};
      ${p => (p.placement === 'bottom' ? 'top: -1px' : '')};
      ${p => (p.placement === 'left' ? 'top: 0; left: 1px;' : '')};
      ${p => (p.placement === 'right' ? 'top: 0; left: -1px' : '')};
    }
    &::after {
      border: 10px solid transparent;
      border-${p => getTipDirection(p.placement)}-color: ${p =>
  p.tipColor ?? p.theme.background};
    }
`;
