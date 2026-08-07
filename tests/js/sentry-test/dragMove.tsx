import {act} from 'sentry-test/reactTestingLibrary';

function dispatch(target: EventTarget, type: string, pageX: number, button: number) {
  const event = new MouseEvent(type, {bubbles: true, button, cancelable: true});
  Object.defineProperty(event, 'pageX', {value: pageX});
  Object.defineProperty(event, 'pageY', {value: 0});
  target.dispatchEvent(event);
}

interface DragOptions {
  from: number;
  to: number;
  button?: number;
  release?: boolean;
}

export function dragHandle(
  handle: HTMLElement,
  {button = 0, from, release = true, to}: DragOptions
) {
  act(() => {
    dispatch(handle, 'mousedown', from, button);
    dispatch(window, 'mousemove', to, button);

    if (release) {
      dispatch(window, 'mouseup', to, button);
    }
  });
}
