import {useState} from 'react';
import {flushSync} from 'react-dom';

import {act, renderHook} from 'sentry-test/reactTestingLibrary';

import {useRAF} from 'sentry/utils/useRAF';

describe('useRAF', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('keeps polling without a render and stops when disabled', () => {
    let time = 0;
    const values: number[] = [];
    const {rerender, unmount} = renderHook(
      ({enabled}) => useRAF(() => values.push(time), {enabled}),
      {initialProps: {enabled: true}}
    );

    act(() => jest.advanceTimersToNextFrame());
    act(() => jest.advanceTimersToNextFrame());
    time = 1_000;
    act(() => jest.advanceTimersToNextFrame());
    expect(values).toEqual([0, 0, 1_000]);

    rerender({enabled: false});
    time = 2_000;
    act(() => jest.advanceTimersToNextFrame());
    expect(values).toEqual([0, 0, 1_000]);
    expect(jest.getTimerCount()).toBe(0);

    rerender({enabled: true});
    act(() => jest.advanceTimersToNextFrame());
    expect(values).toEqual([0, 0, 1_000, 2_000]);

    unmount();
    act(() => jest.advanceTimersToNextFrame());
    expect(values).toEqual([0, 0, 1_000, 2_000]);
    expect(jest.getTimerCount()).toBe(0);
  });

  it('uses the committed callback when a frame fires during a render', () => {
    const values: string[] = [];
    const errors: unknown[] = [];
    const {rerender} = renderHook(
      ({value, fireFrame}) => {
        useRAF(() => values.push(value));
        if (fireFrame) {
          try {
            jest.advanceTimersToNextFrame();
          } catch (error) {
            errors.push(error);
          }
        }
      },
      {initialProps: {value: 'before', fireFrame: false}}
    );

    rerender({value: 'after', fireFrame: true});

    expect(errors).toEqual([]);
    expect(values).toEqual(['before']);

    act(() => jest.advanceTimersToNextFrame());

    expect(values).toEqual(['before', 'after']);
  });

  it('does not reschedule after synchronous self-unmount', () => {
    const onFrame = jest.fn((): void => flushSync(unmount));
    const {unmount} = renderHook(() => useRAF(onFrame));
    expect(jest.getTimerCount()).toBe(1);

    act(() => jest.advanceTimersToNextFrame());

    expect(onFrame).toHaveBeenCalledTimes(1);
    expect(jest.getTimerCount()).toBe(0);
  });

  it('does not reschedule after the callback synchronously disables polling', () => {
    const onFrame = jest.fn();
    const {result} = renderHook(() => {
      const [enabled, setEnabled] = useState(true);
      useRAF(
        () => {
          onFrame();
          flushSync(() => setEnabled(false));
        },
        {enabled}
      );
      return enabled;
    });
    expect(jest.getTimerCount()).toBe(1);

    act(() => jest.advanceTimersToNextFrame());

    expect(result.current).toBe(false);
    expect(onFrame).toHaveBeenCalledTimes(1);
    expect(jest.getTimerCount()).toBe(0);
  });
});
