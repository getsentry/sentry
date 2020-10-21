import * as React from 'react';

type ClickProps<T> = {
  onClick?: React.HTMLAttributes<T>['onClick'];
};

type Props<T extends HTMLElement> = ClickProps<T> & {
  children: React.ReactElement<T>;
};

type State = {
  startCoords?: [number, number];
};

/**
 * Does not fire the onlick event if the mouse has moved outside of the
 * original click location upon release.
 *
 * <StrictClick onClick={this.onClickHandler}>
 *   <button>Some button</button>
 * </StrictClick>
 */
class StrictClick<T extends HTMLElement> extends React.PureComponent<Props<T>, State> {
  static MAX_DELTA_X = 10;
  static MAX_DELTA_Y = 10;

  handleMouseDown = ({screenX, screenY}: React.MouseEvent<T>) =>
    this.setState({startCoords: [screenX, screenY]});

  handleMouseClick = (evt: React.MouseEvent<T>) => {
    if (!this.props.onClick) {
      return;
    }

    const {startCoords} = this.state;

    if (!startCoords) {
      return;
    }

    // Click happens if mouse down/up in same element - click will not fire if
    // either initial mouse down OR final mouse up occurs in different element
    const [x, y] = startCoords;
    const deltaX = Math.abs(evt.screenX - x);
    const deltaY = Math.abs(evt.screenY - y);

    // If mouse hasn't moved more than 10 pixels in either Y or X direction,
    // fire onClick
    if (deltaX < StrictClick.MAX_DELTA_X && deltaY < StrictClick.MAX_DELTA_Y) {
      this.props.onClick(evt);
    }
    this.setState({startCoords: undefined});
  };

  render() {
    // Bail out early if there is no onClick handler
    if (!this.props.onClick) {
      return this.props.children;
    }

    return React.cloneElement(this.props.children, {
      onMouseDown: this.handleMouseDown,
      onClick: this.handleMouseClick,
    });
  }
}

export default StrictClick;
