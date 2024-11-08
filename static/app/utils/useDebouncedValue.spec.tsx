import {act, renderHook} from 'sentry-test/reactTestingLibrary';

import {useDebouncedValue} from 'sentry/utils/useDebouncedValue';

jest.unmock('lodash/debounce');

describe('useDebouncedValue', function () {
  it('properly debounces values changes', function () {
    jest.useFakeTimers();

    const {result, rerender} = renderHook(useDebouncedValue, {
      initialProps: 1,
    });

    expect(result.current).toBe(1);

    // Rerendering with the next value should not update the value immediately
    rerender(2);
    act(() => {
      jest.advanceTimersByTime(100);
    });
    expect(result.current).toBe(1);

    // After enough time has passed, the value should update
    act(() => {
      jest.advanceTimersByTime(1000);
    });
    expect(result.current).toBe(2);
  });
});
