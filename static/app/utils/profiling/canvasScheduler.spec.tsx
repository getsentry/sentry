import type {FlamegraphEvents} from 'sentry/utils/profiling/canvasScheduler';
import {CanvasScheduler} from 'sentry/utils/profiling/canvasScheduler';

const handlers: Array<keyof FlamegraphEvents> = [
  'reset zoom',
  'set config view',
  'highlight frame',
  'transform config view',
  'zoom at frame',
];

describe('CanvasScheduler', () => {
  it.each([handlers])('registers and calls %s', key => {
    const handler = jest.fn();
    const scheduler = new CanvasScheduler();

    scheduler.on(key, handler);
    scheduler.dispatch(key, undefined as any);

    expect(scheduler.events[key].has(handler)).toBe(true);
    expect(handler).toHaveBeenCalledTimes(1);
  });
  it.each([handlers])(
    'does not register duplicate handler and calls %s only once',
    (key: keyof FlamegraphEvents) => {
      const handler = jest.fn();
      const scheduler = new CanvasScheduler();
      scheduler.on(key, handler);
      scheduler.on(key, handler);

      scheduler.dispatch(key, undefined as any);

      expect(scheduler.events[key].has(handler)).toBe(true);
      expect(handler).toHaveBeenCalledTimes(1);
    }
  );
  it.each([handlers])('removes %s registered handler and does not call it', key => {
    const handler = jest.fn();
    const scheduler = new CanvasScheduler();
    scheduler.on(key, handler);
    scheduler.off(key, handler);

    scheduler.dispatch(key, undefined as any);

    expect(scheduler.events[key].has(handler)).toBe(false);
    expect(handler).not.toHaveBeenCalled();
  });
  it('registerBeforeFrameCallback', () => {
    jest.useFakeTimers();

    const drawFn = jest.fn();
    const scheduler = new CanvasScheduler();

    scheduler.registerBeforeFrameCallback(drawFn);
    scheduler.draw();

    jest.runAllTimers();
    expect(drawFn).toHaveBeenCalledTimes(1);
  });
  it('unregisterBeforeFrameCallback', () => {
    jest.useFakeTimers();

    const drawFn = jest.fn();
    const scheduler = new CanvasScheduler();

    scheduler.registerBeforeFrameCallback(drawFn);
    scheduler.unregisterBeforeFrameCallback(drawFn);
    scheduler.draw();

    jest.runAllTimers();
    expect(drawFn).not.toHaveBeenCalled();
  });
  it('registerAfterFrameCallback', () => {
    jest.useFakeTimers();

    const drawFn = jest.fn();
    const scheduler = new CanvasScheduler();

    scheduler.registerAfterFrameCallback(drawFn);
    scheduler.draw();

    jest.runAllTimers();
    expect(drawFn).toHaveBeenCalledTimes(1);
  });
  it('unregisterAfterFrameCallback', () => {
    jest.useFakeTimers();

    const drawFn = jest.fn();
    const scheduler = new CanvasScheduler();

    scheduler.registerAfterFrameCallback(drawFn);
    scheduler.unregisterAfterFrameCallback(drawFn);
    scheduler.draw();

    jest.runAllTimers();
    expect(drawFn).not.toHaveBeenCalled();
  });
  it('calls callbacks in correct order', () => {
    jest.useFakeTimers();

    const drawBeforeFn = jest.fn().mockImplementationOnce(() => {});
    const drawAfterFn = jest.fn();

    const scheduler = new CanvasScheduler();

    scheduler.registerBeforeFrameCallback(drawBeforeFn);
    scheduler.registerAfterFrameCallback(drawAfterFn);

    scheduler.draw();

    jest.runAllTimers();
    expect(drawBeforeFn.mock.invocationCallOrder[0]).toBeLessThan(
      drawAfterFn.mock.invocationCallOrder[0]!
    );
  });
  it('drawSync', () => {
    const drawBeforeFn = jest.fn().mockImplementationOnce(() => {});
    const drawAfterFn = jest.fn();

    const scheduler = new CanvasScheduler();

    scheduler.registerBeforeFrameCallback(drawBeforeFn);
    scheduler.registerAfterFrameCallback(drawAfterFn);

    // If we do not call drawSync, the test will fail as the assertion will
    // be evaluated before the callbacks have ran.
    scheduler.drawSync();

    expect(drawBeforeFn.mock.invocationCallOrder[0]).toBeLessThan(
      drawAfterFn.mock.invocationCallOrder[0]!
    );
  });
  it('dispose', () => {
    jest.useFakeTimers();
    const drawBeforeFn = jest.fn().mockImplementationOnce(() => {});
    const drawAfterFn = jest.fn();

    const handlerFns = handlers.map(key => [key, jest.fn()]);

    const scheduler = new CanvasScheduler();

    scheduler.registerBeforeFrameCallback(drawBeforeFn);
    scheduler.registerAfterFrameCallback(drawAfterFn);

    for (const [key, handler] of handlerFns) {
      // @ts-expect-error register all handlers
      scheduler.on(key, handler);
    }
    scheduler.dispose();
    // If we do not call drawSync, the test will fail as the assertion will
    // be evaluated before the callbacks have ran.
    scheduler.draw();
    scheduler.drawSync();

    jest.runAllTimers();

    for (const [_, handler] of handlerFns) {
      expect(handler).not.toHaveBeenCalled();
    }
  });
});
