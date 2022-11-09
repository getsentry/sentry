import {reactHooks} from 'sentry-test/reactTestingLibrary';

import {useIsMountedRef} from './useIsMountedRef';

describe('useIsMounted', () => {
  it('should return a ref', () => {
    const {result} = reactHooks.renderHook(() => useIsMountedRef());

    expect(result.current).toBeInstanceOf(Object);
  });

  it('should return false within first render', () => {
    const {result} = reactHooks.renderHook(() => {
      const isMountedRef = useIsMountedRef();
      return isMountedRef.current;
    });

    expect(result.current).toBe(false);
  });

  it('should return true after mount', () => {
    const {result} = reactHooks.renderHook(() => useIsMountedRef());

    expect(result.current.current).toBe(true);
  });

  it('should return same function on each render', () => {
    const {result, rerender} = reactHooks.renderHook(() => useIsMountedRef());

    const fn1 = result.current;
    rerender();
    const fn2 = result.current;
    rerender();
    const fn3 = result.current;

    expect(fn1).toBe(fn2);
    expect(fn2).toBe(fn3);
  });

  it('should return false after component unmount', () => {
    const {result, unmount} = reactHooks.renderHook(() => useIsMountedRef());

    expect(result.current.current).toBe(true);

    unmount();

    expect(result.current.current).toBe(false);
  });
});
