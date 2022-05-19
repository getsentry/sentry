import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {createPortal} from 'react-dom';
import {Manager, Popper, PopperProps, Reference} from 'react-popper';
import styled from '@emotion/styled';
import classNames from 'classnames';
import {motion} from 'framer-motion';

import space from 'sentry/styles/space';
import domId from 'sentry/utils/domId';
import {ColorOrAlias} from 'sentry/utils/theme';

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
   * Offset for the arrow
   */
  offset?: string;
  /**
   * Position tooltip should take relative to the child element
   */
  position?: PopperProps<[]>['placement'];
  /**
   * If set, is used INSTEAD OF the hover action to determine whether the hovercard is shown
   */
  show?: boolean;
  /**
   * Whether to add a dotted underline to the trigger element, to indicate the
   * presence of a tooltip.
   */
  showUnderline?: boolean;
  /**
   * Color of the arrow tip border
   */
  tipBorderColor?: string;
  /**
   * Color of the arrow tip
   */
  tipColor?: string;
  /**
   * Color of the dotted underline, if available. See also: showUnderline.
   */
  underlineColor?: ColorOrAlias;
}

function Hovercard({
  body,
  bodyClassName,
  children,
  className,
  containerClassName,
  header,
  offset,
  show,
  showUnderline,
  tipBorderColor,
  tipColor,
  underlineColor,
  displayTimeout = 100,
  position = 'top',
}: HovercardProps): React.ReactElement {
  const [visible, setVisible] = useState(false);

  const tooltipId = useMemo(() => domId('hovercard-'), []);

  const showHoverCardTimeoutRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    return () => {
      window.clearTimeout(showHoverCardTimeoutRef.current);
    };
  }, []);

  const toggleHovercard = useCallback(
    (value: boolean) => {
      window.clearTimeout(showHoverCardTimeoutRef.current);

      // Else enqueue a new timeout
      showHoverCardTimeoutRef.current = window.setTimeout(
        () => setVisible(value),
        displayTimeout
      );
    },
    [displayTimeout]
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
          // Set padding to avoid the arrow reaching the side of the tooltip
          // and overflowing out of the rounded border
          padding: 4,
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
    []
  );

  // If show is not set, then visibility state is uncontrolled
  const isVisible = show === undefined ? visible : show;

  const hoverProps = useMemo((): {
    onMouseEnter?: React.MouseEventHandler<HTMLDivElement>;
    onMouseLeave?: React.MouseEventHandler<HTMLDivElement>;
  } => {
    // If show is not set, then visibility state is controlled by mouse events
    if (show === undefined) {
      return {
        onMouseEnter: () => toggleHovercard(true),
        onMouseLeave: () => toggleHovercard(false),
      };
    }
    return {};
  }, [show, toggleHovercard]);

  return (
    <Manager>
      <Reference>
        {({ref}) => (
          <Trigger
            ref={ref}
            aria-describedby={tooltipId}
            className={containerClassName}
            showUnderline={showUnderline}
            underlineColor={underlineColor}
            {...hoverProps}
          >
            {children}
          </Trigger>
        )}
      </Reference>
      {createPortal(
        <Popper placement={position} modifiers={modifiers}>
          {({ref, style, placement, arrowProps}) => {
            // Element is not visible in neither controlled and uncontrolled
            // state (show prop is not passed and card is not hovered)
            if (!isVisible) {
              return null;
            }

            // Nothing to render
            if (!body && !header) {
              return null;
            }

            return (
              <HovercardContainer style={style} ref={ref}>
                <SlideInAnimation visible={isVisible} placement={placement}>
                  <StyledHovercard
                    id={tooltipId}
                    placement={placement}
                    offset={offset}
                    // Maintain the hovercard class name for BC with less styles
                    className={classNames('hovercard', className)}
                    {...hoverProps}
                  >
                    {header ? <Header>{header}</Header> : null}
                    {body ? <Body className={bodyClassName}>{body}</Body> : null}
                    <HovercardArrow
                      ref={arrowProps.ref}
                      style={arrowProps.style}
                      placement={placement}
                      tipColor={tipColor}
                      tipBorderColor={tipBorderColor}
                    />
                  </StyledHovercard>
                </SlideInAnimation>
              </HovercardContainer>
            );
          }}
        </Popper>,
        document.body
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
  placement: PopperProps<[]>['placement'];
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

const Trigger = styled('span')<{showUnderline?: boolean; underlineColor?: ColorOrAlias}>`
  ${p => p.showUnderline && p.theme.tooltipUnderline(p.underlineColor)};
`;

const HovercardContainer = styled('div')`
  /* Some hovercards overlap the toplevel header and sidebar, and we need to appear on top */
  z-index: ${p => p.theme.zIndex.hovercard};
`;

type StyledHovercardProps = {
  placement: PopperProps<[]>['placement'];
  offset?: string;
};

const StyledHovercard = styled('div')<StyledHovercardProps>`
  position: relative;
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
  placement: PopperProps<[]>['placement'];
  tipBorderColor?: string;
  tipColor?: string;
};

const HovercardArrow = styled('span')<HovercardArrowProps>`
  position: absolute;
  width: 20px;
  height: 20px;
  right: ${p => (p.placement === 'left' ? '-20px' : 'auto')};
  left: ${p => (p.placement === 'right' ? '-20px' : 'auto')};
  bottom: ${p => (p.placement === 'top' ? '-20px' : 'auto')};
  top: ${p => (p.placement === 'bottom' ? '-20px' : 'auto')};

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
