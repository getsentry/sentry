import React from 'react';
import ReactDOM from 'react-dom';
import styled from 'react-emotion';
import PropTypes from 'prop-types';

import {Manager, Reference, Popper} from 'react-popper';
import {domId} from 'app/utils/domId';

class Tooltip extends React.Component {
  static propTypes = {
    /**
     * Disable the tooltip display entirely
     */
    disabled: PropTypes.bool,
    /**
     * The content to show in the tooltip popover
     */
    title: PropTypes.oneOfType([PropTypes.string, PropTypes.element]),
    /**
     * Position for the tooltip.
     */
    position: PropTypes.oneOf([
      'bottom',
      'top',
      'left',
      'right',
      'bottom-start',
      'bottom-end',
      'top-start',
      'top-end',
      'left-start',
      'left-end',
      'right-start',
      'right-end',
      'auto',
    ]),
    /**
     * Additional style rules for the tooltip content.
     */
    popperStyle: PropTypes.oneOfType([PropTypes.string, PropTypes.object]),

    /**
     * Display mode for the container element
     */
    containerDisplayMode: PropTypes.oneOf(['block', 'inline-block', 'inline']),

    /**
     * Time to wait (in milliseconds) before showing the tooltip
     */
    delay: PropTypes.number,
  };

  static defaultProps = {
    position: 'top',
    containerDisplayMode: 'inline-block',
  };

  constructor(props) {
    super(props);

    let portal = document.getElementById('tooltip-portal');
    if (!portal) {
      portal = document.createElement('div');
      portal.setAttribute('id', 'tooltip-portal');
      document.body.appendChild(portal);
    }
    this.portalEl = portal;
  }

  state = {
    isOpen: false,
  };

  componentDidMount() {
    this.tooltipId = domId('tooltip-');
  }

  setOpen = () => {
    this.setState({isOpen: true});
  };

  handleOpen = evt => {
    const {delay} = this.props;

    if (delay) {
      this.delayTimeout = window.setTimeout(this.setOpen, delay);
    } else {
      this.setOpen();
    }
  };

  handleClose = evt => {
    this.setState({isOpen: false});

    if (this.delayTimeout) {
      window.clearTimeout(this.delayTimeout);
      this.delayTimeout = null;
    }
  };

  renderTrigger(children, ref) {
    const propList = {
      'aria-describedby': this.tooltipId,
      onFocus: this.handleOpen,
      onBlur: this.handleClose,
      onMouseEnter: this.handleOpen,
      onMouseLeave: this.handleClose,
    };

    // Use the `type` property of the react instance to detect whether we
    // have a basic element (type=string) or a class/function component (type=function)
    // Because we can't rely on the child element implementing forwardRefs we wrap
    // it with a span tag so that popper has ref
    if (children.type instanceof Function) {
      propList.containerDisplayMode = this.props.containerDisplayMode;
      return (
        <Container {...propList} innerRef={ref}>
          {children}
        </Container>
      );
    }
    // Basic DOM nodes can be cloned and have more props applied.
    return React.cloneElement(children, {
      ...propList,
      ref,
    });
  }

  render() {
    const {disabled, children, title, position, popperStyle} = this.props;
    const {isOpen} = this.state;
    if (disabled || title === '') {
      return children;
    }

    let tip = null;
    const modifiers = {
      hide: {enabled: false},
      preventOverflow: {
        padding: 10,
        enabled: true,
        boundariesElement: 'viewport',
      },
    };

    if (isOpen) {
      tip = ReactDOM.createPortal(
        <Popper placement={position} modifiers={modifiers}>
          {({ref, style, placement, arrowProps}) => (
            <TooltipContent
              id={this.tooltipId}
              className="tooltip-content"
              aria-hidden={!isOpen}
              isOpen={isOpen}
              innerRef={ref}
              style={style}
              data-placement={placement}
              popperStyle={popperStyle}
            >
              {title}
              <TooltipArrow
                innerRef={arrowProps.ref}
                data-placement={placement}
                style={arrowProps.style}
              />
            </TooltipContent>
          )}
        </Popper>,
        this.portalEl
      );
    }

    return (
      <Manager>
        <Reference>{({ref}) => this.renderTrigger(children, ref)}</Reference>
        {tip}
      </Manager>
    );
  }
}

// Using an inline-block solves the container being smaller
// than the elements it is wrapping
const Container = styled('span')`
  display: ${p => p.containerDisplayMode};
`;

const TooltipContent = styled('div')`
  color: #fff;
  background: #000;
  opacity: 0.9;
  padding: 5px 10px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.15);
  border-radius: ${p => p.theme.borderRadius};
  overflow-wrap: break-word;
  max-width: 225px;
  z-index: ${p => p.theme.zIndex.tooltip};

  font-weight: bold;
  font-size: ${p => p.theme.fontSizeSmall};
  line-height: 1.4;

  margin: 6px;
  text-align: center;
  ${props => props.popperStyle};
`;

const TooltipArrow = styled('span')`
  position: absolute;
  width: 10px;
  height: 5px;

  &[data-placement*='bottom'] {
    top: 0;
    left: 0;
    margin-top: -5px;
    &::before {
      border-width: 0 5px 5px 5px;
      border-color: transparent transparent #000 transparent;
    }
  }

  &[data-placement*='top'] {
    bottom: 0;
    left: 0;
    margin-bottom: -5px;
    &::before {
      border-width: 5px 5px 0 5px;
      border-color: #000 transparent transparent transparent;
    }
  }

  &[data-placement*='right'] {
    left: 0;
    margin-left: -5px;
    &::before {
      border-width: 5px 5px 5px 0;
      border-color: transparent #000 transparent transparent;
    }
  }

  &[data-placement*='left'] {
    right: 0;
    margin-right: -5px;
    &::before {
      border-width: 5px 0 5px 5px;
      border-color: transparent transparent transparent #000;
    }
  }

  &::before {
    content: '';
    margin: auto;
    display: block;
    width: 0;
    height: 0;
    border-style: solid;
  }
`;

export default Tooltip;
