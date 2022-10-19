import {reactHooks} from 'sentry-test/reactTestingLibrary';

import useTimeout from './useTimeout';

jest.useFakeTimers();

describe('useTimeout', () => {
  const timeMs = 500;
  const onTimeout = jest.fn();

  beforeEach(() => {
    onTimeout.mockReset();
  });

  it('should timeout after a specified delay', () => {
    const {result} = reactHooks.renderHook(useTimeout, {
      initialProps: {timeMs, onTimeout},
    });

    result.current.start();
    expect(onTimeout).not.toHaveBeenCalled();

    jest.advanceTimersByTime(timeMs + 10);

    expect(onTimeout).toHaveBeenCalled();
  });

  it('should call the callback if a timeout is ended early', () => {
    const {result} = reactHooks.renderHook(useTimeout, {
      initialProps: {timeMs, onTimeout},
    });

    result.current.start();
    expect(onTimeout).not.toHaveBeenCalled();
    result.current.end();

    expect(onTimeout).toHaveBeenCalled();
  });

  it('should not exec the callback if a timeout is cancelled', () => {
    const {result} = reactHooks.renderHook(useTimeout, {
      initialProps: {timeMs, onTimeout},
    });

    result.current.start();
    expect(onTimeout).not.toHaveBeenCalled();
    result.current.cancel();

    expect(onTimeout).not.toHaveBeenCalled();
  });

  it('should return stable start/cancel/end callbacks', () => {
    const {result, rerender} = reactHooks.renderHook(useTimeout, {
      initialProps: {timeMs, onTimeout},
    });

    const firstRender = {...result.current};

    rerender();

    expect(result.current.start).toBe(firstRender.start);
    expect(result.current.cancel).toBe(firstRender.cancel);
    expect(result.current.end).toBe(firstRender.end);
  });

  it('should return a new start() method when timeMs changes', () => {
    const {result, rerender} = reactHooks.renderHook(useTimeout, {
      initialProps: {timeMs, onTimeout},
    });

    const firstRender = {...result.current};
    rerender({timeMs: 999, onTimeout});

    expect(result.current.cancel).toBe(firstRender.cancel);
    expect(result.current.end).toBe(firstRender.end);

    expect(result.current.start).not.toBe(firstRender.start);
  });

  it('should return a new start() and end() method when onTimeout changes', () => {
    const {result, rerender} = reactHooks.renderHook(useTimeout, {
      initialProps: {timeMs, onTimeout},
    });

    const firstRender = {...result.current};

    rerender({timeMs, onTimeout: jest.fn()});

    expect(result.current.cancel).toBe(firstRender.cancel);

    expect(result.current.start).not.toBe(firstRender.start);
    expect(result.current.end).not.toBe(firstRender.end);
  });

  it('should not exec the callback after unmount', () => {
    const {result, unmount} = reactHooks.renderHook(useTimeout, {
      initialProps: {timeMs, onTimeout},
    });

    result.current.start();

    unmount();

    jest.runAllTimers();

    expect(onTimeout).not.toHaveBeenCalled();
  });
});
