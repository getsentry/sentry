import {renderHook} from 'sentry-test/reactTestingLibrary';

import usePrevious from 'sentry/utils/usePrevious';

describe('usePrevious', () => {
  it('stores initial value', () => {
    const {result} = renderHook(usePrevious, {initialProps: 'Initial Value'});
    expect(result.current).toBe('Initial Value');
  });

  it('provides initial value', () => {
    const {result} = renderHook(usePrevious, {
      initialProps: 'Initial Value',
    });

    expect(result.current).toBe('Initial Value');
  });

  it('provides previous value', () => {
    const {result, rerender} = renderHook(usePrevious<string | undefined>, {
      initialProps: undefined,
    });

    rerender('New Value');
    // We did not pass anything under initialProps
    expect(result.current).toBeUndefined();
    rerender('New New Value');
    // Result should point to old value
    expect(result.current).toBe('New Value');
  });

  it('skips updates when needed', () => {
    const {result, rerender} = renderHook(
      ([value, shouldUpdate]) => usePrevious<number>(value, shouldUpdate),
      {initialProps: [0] as [number] | [number, boolean]}
    );

    rerender([1]);
    // Result should point at initial prop of 0
    expect(result.current).toBe(0);
    rerender([2, true]);
    // Result should point to previous prop of 1
    expect(result.current).toBe(1);
    rerender([3]);
    // Result should point to previous prop of 1 because 2 was skipped
    expect(result.current).toBe(1);
  });
});
