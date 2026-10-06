import {act} from 'sentry-test/reactTestingLibrary';

export function mockAnimationFrame() {
  const frames = new Map<number, FrameRequestCallback>();
  let frameId = 0;
  jest.spyOn(window, 'requestAnimationFrame').mockImplementation(callback => {
    frames.set(++frameId, callback);
    return frameId;
  });
  jest.spyOn(window, 'cancelAnimationFrame').mockImplementation(id => {
    frames.delete(id);
  });

  function advanceFrame() {
    act(() => {
      const callbacks = [...frames.values()];
      // A browser removes pending callbacks before invoking them.
      frames.clear();
      callbacks.forEach(callback => callback(0));
    });
  }

  return {advanceFrame, frames};
}
