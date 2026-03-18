import {act, renderHook} from 'sentry-test/reactTestingLibrary';

import {sessionStorageWrapper} from 'sentry/utils/sessionStorage';

import {useSessionStorage} from './useSessionStorage';

describe('useSessionStorage', () => {
  beforeEach(() => {
    sessionStorageWrapper.clear();
  });

  it('returns initial value when storage is empty', () => {
    const {result} = renderHook(() => useSessionStorage('key', 'initial'));
    expect(result.current[0]).toBe('initial');
  });

  it('reads existing value from session storage', () => {
    sessionStorageWrapper.setItem('key', JSON.stringify('stored'));
    const {result} = renderHook(() => useSessionStorage('key', 'initial'));
    expect(result.current[0]).toBe('stored');
  });

  it('sets a direct value', () => {
    const {result} = renderHook(() => useSessionStorage('key', 'initial'));

    act(() => {
      result.current[1]('updated');
    });

    expect(result.current[0]).toBe('updated');
    expect(JSON.parse(sessionStorageWrapper.getItem('key')!)).toBe('updated');
  });

  it('supports functional updater', () => {
    const {result} = renderHook(() => useSessionStorage('key', 0));

    act(() => {
      result.current[1](prev => prev + 1);
    });

    expect(result.current[0]).toBe(1);
    expect(JSON.parse(sessionStorageWrapper.getItem('key')!)).toBe(1);
  });

  it('functional updater reads latest state for sequential calls', () => {
    const {result} = renderHook(() =>
      useSessionStorage<{a?: number; b?: number}>('key', {})
    );

    act(() => {
      result.current[1](prev => ({...prev, a: 1}));
      result.current[1](prev => ({...prev, b: 2}));
    });

    // Both updates should be applied -- b should not clobber a
    expect(result.current[0]).toEqual({a: 1, b: 2});
    expect(JSON.parse(sessionStorageWrapper.getItem('key')!)).toEqual({a: 1, b: 2});
  });

  it('removes item from storage', () => {
    sessionStorageWrapper.setItem('key', JSON.stringify('stored'));
    const {result} = renderHook(() => useSessionStorage('key', 'initial'));

    act(() => {
      result.current[2]();
    });

    expect(result.current[0]).toBe('initial');
    expect(sessionStorageWrapper.getItem('key')).toBeNull();
  });
});
