import {act} from 'sentry-test/reactTestingLibrary';

function dispatch(
  target: EventTarget,
  type: string,
  pageX: number,
  pageY: number,
  button: number
) {
  const event = new MouseEvent(type, {bubbles: true, button, cancelable: true});
  Object.defineProperty(event, 'pageX', {value: pageX});
  Object.defineProperty(event, 'pageY', {value: pageY});
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
    dispatch(handle, 'mousedown', from, 0, button);
    dispatch(window, 'mousemove', to, y, button);

    if (release) {
      dispatch(window, 'mouseup', to, y, button);
    }
  });
}
