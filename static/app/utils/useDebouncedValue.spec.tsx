import {act, renderHook} from 'sentry-test/reactTestingLibrary';

import {useDebouncedValue} from 'sentry/utils/useDebouncedValue';

vi.unmock('lodash/debounce');

describe('useDebouncedValue', function () {
  it('properly debounces values changes', function () {
    vi.useRealTimers();
    vi.useFakeTimers();

    const {result, rerender} = renderHook(useDebouncedValue, {
      initialProps: 1,
    });

    expect(result.current).toBe(1);

    // Rerendering with the next value should not update the value immediately
    rerender(2);
    act(() => {
      vi.advanceTimersByTime(100);
    });
    expect(result.current).toBe(1);

    // After enough time has passed, the value should update
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(result.current).toBe(2);
  });
});
