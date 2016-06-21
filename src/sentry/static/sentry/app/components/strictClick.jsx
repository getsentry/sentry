import React from 'react';
import PureRenderMixin from 'react-addons-pure-render-mixin';

/**
 * Usage:
 *   <StrictClick onClick={this.onClickHandler}>
 *     <button>Some button</button>
 *   </StrictClick>
 */
const StrictClick = React.createClass({
  propTypes: {
    onClick: React.PropTypes.func
  },

  mixins: [
    PureRenderMixin
  ],

  statics: {
    MAX_DELTA_X: 10,
    MAX_DELTA_Y: 10
  },

  getInitialState() {
    return {
      startCoords: null
    };
  },

  handleMouseDown: function(evt) {
    this.setState({
      startCoords: {
        x: evt.screenX,
        y: evt.screenY
      }
    });
  },

  handleMouseClick: function(evt) {
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
      startCoords: null
    });
  },

  render() {
    // Bail out early if there is no onClick handler
    if (!this.props.onClick) return this.props.children;

    return React.cloneElement(this.props.children, {
      onMouseDown: this.handleMouseDown,
      onClick: this.handleMouseClick
    });
  }
});

export default StrictClick;

