import {act, renderHook} from 'sentry-test/reactTestingLibrary';

import {setXRayModeEnabled, toggleXRayMode, useXRayModeEnabled} from './xrayModeStore';

describe('xrayModeStore', () => {
  afterEach(() => {
    act(() => setXRayModeEnabled(false));
    window.localStorage.removeItem('seer-xray-mode-enabled');
  });

  it('defaults to disabled', () => {
    const {result} = renderHook(() => useXRayModeEnabled());
    expect(result.current).toBe(false);
  });

  it('toggles and persists to localStorage', () => {
    const {result} = renderHook(() => useXRayModeEnabled());

    act(() => toggleXRayMode());
    expect(result.current).toBe(true);
    expect(window.localStorage.getItem('seer-xray-mode-enabled')).toBe('1');

    act(() => toggleXRayMode());
    expect(result.current).toBe(false);
    expect(window.localStorage.getItem('seer-xray-mode-enabled')).toBe('0');
  });

  it('notifies subscribers via useXRayModeEnabled', () => {
    const {result} = renderHook(() => useXRayModeEnabled());
    expect(result.current).toBe(false);

    act(() => setXRayModeEnabled(true));
    expect(result.current).toBe(true);
  });

  it('is a no-op when set to the value already in effect', () => {
    const {result} = renderHook(() => useXRayModeEnabled());
    act(() => setXRayModeEnabled(false));
    expect(result.current).toBe(false);
  });
});
