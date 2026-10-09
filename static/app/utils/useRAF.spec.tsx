import {useState} from 'react';
import {flushSync} from 'react-dom';

import {act, cleanup, renderHook} from 'sentry-test/reactTestingLibrary';

import {useRAF} from 'sentry/utils/useRAF';

describe('useRAF cleanup', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    try {
      cleanup();
      act(() => jest.runOnlyPendingTimers());
    } finally {
      jest.useRealTimers();
    }
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
