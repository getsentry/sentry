import {useState} from 'react';
import {flushSync} from 'react-dom';

import {mockAnimationFrame} from 'sentry-test/mockAnimationFrame';
import {renderHook} from 'sentry-test/reactTestingLibrary';

import {useRAF} from 'sentry/utils/useRAF';

describe('useRAF cleanup', () => {
  let raf: ReturnType<typeof mockAnimationFrame>;

  beforeEach(() => {
    raf = mockAnimationFrame();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('does not reschedule after synchronous self-unmount', () => {
    const onFrame = jest.fn((): void => flushSync(unmount));
    const {unmount} = renderHook(() => useRAF(onFrame));
    expect(raf.frames.size).toBe(1);

    raf.advanceFrame();

    expect(onFrame).toHaveBeenCalledTimes(1);
    expect(raf.frames.size).toBe(0);
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
    expect(raf.frames.size).toBe(1);

    raf.advanceFrame();

    expect(result.current).toBe(false);
    expect(onFrame).toHaveBeenCalledTimes(1);
    expect(raf.frames.size).toBe(0);
  });
});
