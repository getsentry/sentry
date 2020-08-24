import PropTypes from 'prop-types';
import React from 'react';
import ReactDOM from 'react-dom';
import classNames from 'classnames';
import {Manager, Reference, Popper, PopperProps} from 'react-popper';
import styled from '@emotion/styled';
import {keyframes} from '@emotion/core';

import {fadeIn} from 'app/styles/animations';
import space from 'app/styles/space';
import {domId} from 'app/utils/domId';

const VALID_DIRECTIONS = ['top', 'bottom', 'left', 'right'] as const;

type Direction = typeof VALID_DIRECTIONS[number];

type DefaultProps = {
  /**
   * Time in ms until hovercard is hidden
   */
  displayTimeout: number;
  /**
   * Position tooltip should take relative to the child element
   */
  position: Direction;
};

type Props = DefaultProps & {
  /**
   * Classname to apply to the hovercard
   */
  className?: string;
  /**
   * Classname to apply to the hovercard container
   */
  containerClassName?: string;
  /**
   * Element to display in the header
   */
  header?: React.ReactNode;
  /**
   * Element to display in the body
   */
  body?: React.ReactNode;
  /**
   * Classname to apply to body container
   */
  bodyClassName?: string;
  /**
   * If set, is used INSTEAD OF the hover action to determine whether the hovercard is shown
   */
  show?: boolean;
  /**
   * Color of the arrow tip
   */
  tipColor?: string;
  /**
   * Offset for the arrow
   */
  offset?: string;
};

type State = {
  visible: boolean;
};

class Hovercard extends React.Component<Props, State> {
  static propTypes = {
    displayTimeout: PropTypes.number,
    className: PropTypes.string,
    containerClassName: PropTypes.string,
    header: PropTypes.node,
    body: PropTypes.node,
    bodyClassName: PropTypes.string,
    position: PropTypes.oneOf(VALID_DIRECTIONS),
    show: PropTypes.bool,
    tipColor: PropTypes.string,
    offset: PropTypes.string,
  };

  static defaultProps: DefaultProps = {
    displayTimeout: 100,
    position: 'top',
  };

  constructor(args: Props) {
    super(args);

    let portal = document.getElementById('hovercard-portal');
    if (!portal) {
      portal = document.createElement('div');
      portal.setAttribute('id', 'hovercard-portal');
      document.body.appendChild(portal);
    }
    this.portalEl = portal;
    this.tooltipId = domId('hovercard-');
  }

  state = {
    visible: false,
  };

  portalEl: HTMLElement;
  tooltipId: string;
  hoverWait: number | null = null;

  handleToggleOn = () => this.toggleHovercard(true);
  handleToggleOff = () => this.toggleHovercard(false);

  toggleHovercard = (visible: boolean) => {
    const {header, body, displayTimeout} = this.props;

    // Don't toggle hovercard if both of these are null
    if (!header && !body) {
      return;
    }
    if (this.hoverWait) {
      clearTimeout(this.hoverWait);
    }

    this.hoverWait = window.setTimeout(() => this.setState({visible}), displayTimeout);
  };

  render() {
    const {
      bodyClassName,
      containerClassName,
      className,
      header,
      body,
      position,
      show,
      tipColor,
      offset,
    } = this.props;

    // Maintain the hovercard class name for BC with less styles
    const cx = classNames('hovercard', className);
    const modifiers: PopperProps['modifiers'] = {
      hide: {
        enabled: false,
      },
      preventOverflow: {
        padding: 10,
        enabled: true,
        boundariesElement: 'viewport',
      },
    };

    const visible = show !== undefined ? show : this.state.visible;
    const hoverProps =
      show !== undefined
        ? {}
        : {onMouseEnter: this.handleToggleOn, onMouseLeave: this.handleToggleOff};

    return (
      <Manager>
        <Reference>
          {({ref}) => (
            <span
              ref={ref}
              aria-describedby={this.tooltipId}
              className={containerClassName}
              {...hoverProps}
            >
              {this.props.children}
            </span>
          )}
        </Reference>
        {visible &&
          ReactDOM.createPortal(
            <Popper placement={position} modifiers={modifiers}>
              {({ref, style, placement, arrowProps}) => (
                <StyledHovercard
                  id={this.tooltipId}
                  visible={visible}
                  ref={ref}
                  style={style}
                  placement={placement as Direction}
                  offset={offset}
                  className={cx}
                  {...hoverProps}
                >
                  {header && <Header>{header}</Header>}
                  {body && <Body className={bodyClassName}>{body}</Body>}
                  <HovercardArrow
                    ref={arrowProps.ref}
                    style={arrowProps.style}
                    placement={placement as Direction}
                    tipColor={tipColor}
                  />
                </StyledHovercard>
              )}
            </Popper>,
            this.portalEl
          )}
      </Manager>
    );
  }
}

// Slide in from the same direction as the placement
// so that the card pops into place.
const slideIn = (p: StyledHovercardProps) => keyframes`
  from {
    ${p.placement === 'top' ? 'top: -10px;' : ''}
    ${p.placement === 'bottom' ? 'top: 10px;' : ''}
    ${p.placement === 'left' ? 'left: -10px;' : ''}
    ${p.placement === 'right' ? 'left: 10px;' : ''}
  }
  to {
    ${p.placement === 'top' ? 'top: 0;' : ''}
    ${p.placement === 'bottom' ? 'top: 0;' : ''}
    ${p.placement === 'left' ? 'left: 0;' : ''}
    ${p.placement === 'right' ? 'left: 0;' : ''}
  }
`;

const getTipDirection = (p: HovercardArrowProps) =>
  VALID_DIRECTIONS.includes(p.placement) ? p.placement : 'top';

const getOffset = (p: StyledHovercardProps) => p.offset ?? space(2);

type StyledHovercardProps = {
  visible: boolean;
  placement: Direction;
  offset?: string;
};

const StyledHovercard = styled('div')<StyledHovercardProps>`
  border-radius: ${p => p.theme.borderRadius};
  text-align: left;
  padding: 0;
  line-height: 1;
  /* Some hovercards overlap the toplevel header and sidebar, and we need to appear on top */
  z-index: ${p => p.theme.zIndex.hovercard};
  white-space: initial;
  color: ${p => p.theme.gray800};
  border: 1px solid ${p => p.theme.border};
  background: ${p => p.theme.white};
  background-clip: padding-box;
  box-shadow: 0 0 35px 0 rgba(67, 62, 75, 0.2);
  width: 295px;

  /* The hovercard may appear in different contexts, don't inherit fonts */
  font-family: ${p => p.theme.text.family};

  position: absolute;
  visibility: ${p => (p.visible ? 'visible' : 'hidden')};

  animation: ${fadeIn} 100ms, ${slideIn} 100ms ease-in-out;
  animation-play-state: ${p => (p.visible ? 'running' : 'paused')};

  /* Offset for the arrow */
  ${p => (p.placement === 'top' ? `margin-bottom: ${getOffset(p)}` : '')};
  ${p => (p.placement === 'bottom' ? `margin-top: ${getOffset(p)}` : '')};
  ${p => (p.placement === 'left' ? `margin-right: ${getOffset(p)}` : '')};
  ${p => (p.placement === 'right' ? `margin-left: ${getOffset(p)}` : '')};
`;

const Header = styled('div')`
  font-size: ${p => p.theme.fontSizeMedium};
  background: ${p => p.theme.gray100};
<<<<<<< HEAD:src/sentry/static/sentry/app/components/hovercard.tsx
  border-bottom: 1px solid ${p => p.theme.borderLight};
  border-radius: ${p => p.theme.borderRadiusTop};
=======
  border-bottom: 1px solid ${p => p.theme.border};
  border-radius: 4px 4px 0 0;
>>>>>>> 4749b41398... feat(ui): Change border colors to use single color:src/sentry/static/sentry/app/components/hovercard.jsx
  font-weight: 600;
  word-wrap: break-word;
  padding: ${space(1.5)};
`;

const Body = styled('div')`
  padding: ${space(2)};
  min-height: 30px;
`;

type HovercardArrowProps = {placement: Direction; tipColor?: string};

const HovercardArrow = styled('span')<HovercardArrowProps>`
  position: absolute;
  width: 20px;
  height: 20px;
  z-index: -1;

  ${p => (p.placement === 'top' ? 'bottom: -20px; left: 0' : '')};
  ${p => (p.placement === 'bottom' ? 'top: -20px; left: 0' : '')};
  ${p => (p.placement === 'left' ? 'right: -20px' : '')};
  ${p => (p.placement === 'right' ? 'left: -20px' : '')};

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
    border-${getTipDirection}-color: ${p => p.tipColor || p.theme.border};

    ${p => (p.placement === 'bottom' ? 'top: -1px' : '')};
    ${p => (p.placement === 'left' ? 'top: 0; left: 1px;' : '')};
    ${p => (p.placement === 'right' ? 'top: 0; left: -1px' : '')};
  }
  &::after {
    border: 10px solid transparent;
    border-${getTipDirection}-color: ${p =>
  p.tipColor || (p.placement === 'bottom' ? p.theme.gray100 : p.theme.white)};
  }
`;

export {Hovercard, Body};
export default Hovercard;
