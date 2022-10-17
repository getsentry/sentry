import {cloneElement, useCallback, useRef} from 'react';

type ClickProps<T> = {
  onClick?: React.HTMLAttributes<T>['onClick'];
};

interface Props<T extends HTMLElement> extends ClickProps<T> {
  children: React.ReactElement;
}

/**
 * Does not fire the onclick event if the mouse has moved outside of the
 * original click location upon release.
 *
 * <StrictClick onClick={onClickHandler}>
 *   <button>Some button</button>
 * </StrictClick>
 */
const MAX_DELTA_X = 10;
const MAX_DELTA_Y = 10;

function StrictClick<T extends HTMLElement>({onClick, children}: Props<T>) {
  const mouseDownCoordinates = useRef<[number, number] | null>(null);

  const handleMouseDown = useCallback((event: React.MouseEvent<T>) => {
    mouseDownCoordinates.current = [event.screenX, event.screenY];
  }, []);

  const handleMouseClick = useCallback(
    (evt: React.MouseEvent<T>) => {
      if (!onClick) {
        return;
      }

      if (mouseDownCoordinates.current === null) {
        return;
      }

      // Click happens if mouse down/up in same element - click will not fire if
      // either initial mouse down OR final mouse up occurs in different element
      const [x, y] = mouseDownCoordinates.current;
      const deltaX = Math.abs(evt.screenX - x);
      const deltaY = Math.abs(evt.screenY - y);

      // If mouse hasn't moved more than 10 pixels in either Y or X direction,
      // fire onClick
      if (deltaX < MAX_DELTA_X && deltaY < MAX_DELTA_Y) {
        onClick(evt);
      }
      mouseDownCoordinates.current = null;
    },
    [onClick]
  );

  // Bail out early if there is no onClick handler
  if (!onClick) {
    return children;
  }

  return cloneElement(children, {
    onMouseDown: handleMouseDown,
    onClick: handleMouseClick,
  });
}

export default StrictClick;
