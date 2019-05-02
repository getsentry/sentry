import React from 'react';
import ReactDOM from 'react-dom';
import styled from 'react-emotion';
import PropTypes from 'prop-types';

import {Manager, Reference, Popper} from 'react-popper';

class Tooltip2 extends React.Component {
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
     * Set to true if your reference element is a styled component
     * or needs to receive `innerRef`
     */
    isStyled: PropTypes.bool,
    /**
     * Additional style rules for the tooltip content.
     */
    popperStyle: PropTypes.oneOfType([PropTypes.string, PropTypes.object]),
  };

  static defaultProps = {
    position: 'top',
    isStyled: false,
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
    this.tooltipId =
      'tooltip_' +
      Math.random()
        .toString(36)
        .substr(2, 10);
  }

  handleOpen = evt => {
    this.setState({isOpen: true});
  };

  handleClose = evt => {
    this.setState({isOpen: false});
  };

  render() {
    const {disabled, children, title, position, popperStyle, isStyled} = this.props;
    const {isOpen} = this.state;
    if (disabled) {
      return children;
    }

    let tip = null;
    if (isOpen) {
      tip = ReactDOM.createPortal(
        <Popper placement={position}>
          {({ref, style, placement, arrowProps}) => (
            <TooltipContent
              id={this.tooltipId}
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
        <Reference>
          {({ref}) => {
            return React.cloneElement(children, {
              'aria-describedby': this.tooltipId,
              onFocus: this.handleOpen,
              onBlur: this.handleOpen,
              onMouseEnter: this.handleOpen,
              onMouseLeave: this.handleClose,
              ...(isStyled ? {innerRef: ref} : {ref}),
            });
          }}
        </Reference>
        {tip}
      </Manager>
    );
  }
}

const TooltipContent = styled('span')`
  color: #fff;
  background: #000;
  opacity: 0.9;
  padding: 5px 10px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.15);
  border-radius: ${p => p.theme.borderRadius};
  overflow-wrap: break-word;
  max-width: 200px;

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

export default Tooltip2;
