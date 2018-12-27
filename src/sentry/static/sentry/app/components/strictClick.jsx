import PropTypes from 'prop-types';
import React from 'react';

/**
 * Usage:
 *   <StrictClick onClick={this.onClickHandler}>
 *     <button>Some button</button>
 *   </StrictClick>
 */
class StrictClick extends React.PureComponent {
  static propTypes = {
    onClick: PropTypes.func,
  };

  static MAX_DELTA_X = 10;
  static MAX_DELTA_Y = 10;

  constructor(...args) {
    super(...args);
    this.state = {
      startCoords: null,
    };
  }

  handleMouseDown = evt => {
    this.setState({
      startCoords: {
        x: evt.screenX,
        y: evt.screenY,
      },
    });
  };

  handleMouseClick = evt => {
    // Click happens if mouse down/up in same element - click will
    // not fire if either initial mouse down OR final ouse up occurs in
    // different element
    let {startCoords} = this.state;
    let deltaX = Math.abs(evt.screenX - startCoords.x);
    let deltaY = Math.abs(evt.screenY - startCoords.y);

    // If mouse hasn't moved more than 10 pixels in either Y
    // or X direction, fire onClick
    if (deltaX < StrictClick.MAX_DELTA_X && deltaY < StrictClick.MAX_DELTA_Y) {
      this.props.onClick(evt);
    }
    this.setState({
      startCoords: null,
    });
  };

  render() {
    // Bail out early if there is no onClick handler
    if (!this.props.onClick) return this.props.children;

    return React.cloneElement(this.props.children, {
      onMouseDown: this.handleMouseDown,
      onClick: this.handleMouseClick,
    });
  }
}

export default StrictClick;
