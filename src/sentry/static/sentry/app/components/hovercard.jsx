import PropTypes from 'prop-types';
import React from 'react';
import ReactDOM from 'react-dom';
import classNames from 'classnames';
import {Manager, Reference, Popper} from 'react-popper';
import styled, {keyframes} from 'react-emotion';

import {fadeIn} from 'app/styles/animations';
import space from 'app/styles/space';
import {domId} from 'app/utils/domId';

const VALID_DIRECTIONS = ['top', 'bottom', 'left', 'right'];

class Hovercard extends React.Component {
  static propTypes = {
    /**
     * Time in ms until hovercard is hidden
     */
    displayTimeout: PropTypes.number,
    /**
     * Classname to apply to the hovercard
     */
    className: PropTypes.string,
    /**
     * Classname to apply to the hovercard container
     */
    containerClassName: PropTypes.string,
    /**
     * Element to display in the header
     */
    header: PropTypes.node,
    /**
     * Element to display in the body
     */
    body: PropTypes.node,
    /**
     * Classname to apply to body container
     */
    bodyClassName: PropTypes.string,
    /**
     * Position tooltip should take relative to the child element
     */
    position: PropTypes.oneOf(VALID_DIRECTIONS),
    /**
     * If set, is used INSTEAD OF the hover action to determine whether the hovercard is shown
     */
    show: PropTypes.bool,
    /**
     * Color of the arrow tip
     */
    tipColor: PropTypes.string,
  };

  static defaultProps = {
    displayTimeout: 100,
    position: 'top',
  };

  constructor(...args) {
    super(...args);

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

  handleToggleOn = () => this.toggleHovercard(true);
  handleToggleOff = () => this.toggleHovercard(false);

  toggleHovercard = visible => {
    const {header, body, displayTimeout} = this.props;

    // Don't toggle hovercard if both of these are null
    if (!header && !body) {
      return;
    }
    if (this.hoverWait) {
      clearTimeout(this.hoverWait);
    }

    this.hoverWait = setTimeout(() => this.setState({visible}), displayTimeout);
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
    } = this.props;

    // Maintain the hovercard class name for BC with less styles
    const cx = classNames('hovercard', className);
    const modifiers = {
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
                  innerRef={ref}
                  style={style}
                  placement={placement}
                  withHeader={!!header}
                  className={cx}
                  {...hoverProps}
                >
                  {header && <Header>{header}</Header>}
                  {body && <Body className={bodyClassName}>{body}</Body>}
                  <HovercardArrow
                    innerRef={arrowProps.ref}
                    style={arrowProps.style}
                    placement={placement}
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
const slideIn = p => keyframes`
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

const getTipColor = p => (p.placement === 'bottom' ? p.theme.offWhite : '#fff');
const getTipDirection = p =>
  VALID_DIRECTIONS.includes(p.placement) ? p.placement : 'top';

const StyledHovercard = styled('div')`
  border-radius: 4px;
  text-align: left;
  padding: 0;
  line-height: 1;
  /* Some hovercards overlap the toplevel header and sidebar, and we need to appear on top */
  z-index: ${p => p.theme.zIndex.tooltip};
  white-space: initial;
  color: ${p => p.theme.gray5};
  border: 1px solid ${p => p.theme.borderLight};
  background: #fff;
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
  ${p => (p.placement === 'top' ? 'margin-bottom: 15px' : '')};
  ${p => (p.placement === 'bottom' ? 'margin-top: 15px' : '')};
  ${p => (p.placement === 'left' ? 'margin-right: 15px' : '')};
  ${p => (p.placement === 'right' ? 'margin-left: 15px' : '')};
`;

const Header = styled('div')`
  font-size: 14px;
  background: ${p => p.theme.offWhite};
  border-bottom: 1px solid ${p => p.theme.borderLight};
  border-radius: 4px 4px 0 0;
  font-weight: 600;
  word-wrap: break-word;

  /* The font needs a little extra padding. It has funny vert alignment. */
  padding: ${space(2 * 0.6)} ${space(2 * 0.75)};
  padding-top: ${space(2 * 0.75)};
`;

const Body = styled('div')`
  padding: ${space(2)};
  min-height: 30px;
`;

const HovercardArrow = styled('span')`
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
    /* stylelint-disable-next-line property-no-unknown */
    border-${getTipDirection}-color: ${p => p.tipColor || p.theme.borderLight};

    ${p => (p.placement === 'bottom' ? 'top: -1px' : '')};
    ${p => (p.placement === 'left' ? 'top: 0; left: 1px;' : '')};
    ${p => (p.placement === 'right' ? 'top: 0; left: -1px' : '')};
  }
  &::after {
    border: 10px solid transparent;
    /* stylelint-disable-next-line property-no-unknown */
    border-${getTipDirection}-color: ${p => p.tipColor || getTipColor(p)};
  }
`;

export default Hovercard;
