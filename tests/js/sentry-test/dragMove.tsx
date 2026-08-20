import {act} from 'sentry-test/reactTestingLibrary';

function dispatch(
  target: EventTarget,
  type: string,
  pageX: number,
  pageY: number,
  button: number
) {
  const event = new PointerEvent(type, {
    bubbles: true,
    button,
    buttons: type === 'pointerup' ? 0 : button === 0 ? 1 : 4,
    cancelable: true,
    clientX: pageX,
    clientY: pageY,
    isPrimary: true,
    pointerId: 1,
    pointerType: 'mouse',
  });
  target.dispatchEvent(event);
}

interface DragOptions {
  from: number;
  to: number;
  button?: number;
  release?: boolean;
  y?: number;
}

export function dragHandle(
  handle: HTMLElement,
  {button = 0, from, release = true, to, y = 0}: DragOptions
) {
  act(() => {
    // React Aria uses pointer listeners when PointerEvent is available, as it is
    // in browsers and jsdom 27+.
    dispatch(handle, 'pointerdown', from, 0, button);
    dispatch(window, 'pointermove', to, y, button);

    if (release) {
      dispatch(window, 'pointerup', to, y, button);
    }
  });
}
