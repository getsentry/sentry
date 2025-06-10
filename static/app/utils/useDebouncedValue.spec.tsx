import {act, renderHook} from 'sentry-test/reactTestingLibrary';

import {useDebouncedValue} from 'sentry/utils/useDebouncedValue';

jest.unmock('lodash/debounce');

describe('useDebouncedValue', function () {
  it('properly debounces values changes', function () {
    jest.useFakeTimers();

    const {result, rerender} = renderHook(useDebouncedValue, {
      initialProps: 1,
    });

    expect(result.current.value).toBe(1);

    // Rerendering with the next value should not update the value immediately
    rerender(2);
    act(() => {
      jest.advanceTimersByTime(100);
    });
    expect(result.current.value).toBe(1);

    // After enough time has passed, the value should update
    act(() => {
      jest.advanceTimersByTime(1000);
    });
    expect(result.current.value).toBe(2);
  });

  it('properly sets isDebouncing indicator', function () {
    jest.useFakeTimers();

    const {result, rerender} = renderHook(useDebouncedValue, {
      initialProps: 1,
    });

    expect(result.current.isDebouncing).toBe(false);

    // Rerendering with the next value should set isDebouncing to true
    rerender(2);
    act(() => {
      jest.advanceTimersByTime(100);
    });
    expect(result.current.isDebouncing).toBe(true);

    // After enough time has passed isDebouncing should be false
    act(() => {
      jest.advanceTimersByTime(1000);
    });
    expect(result.current.isDebouncing).toBe(false);
  });
});
