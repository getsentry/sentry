import {act, renderHook} from 'sentry-test/reactTestingLibrary';

import {
  isXRayModeEnabled,
  setXRayModeEnabled,
  toggleXRayMode,
  useXRayModeEnabled,
} from './xrayModeStore';

describe('xrayModeStore', () => {
  afterEach(() => {
    act(() => setXRayModeEnabled(false));
    window.localStorage.removeItem('seer-xray-mode-enabled');
  });

  it('defaults to disabled', () => {
    expect(isXRayModeEnabled()).toBe(false);
  });

  it('toggles and persists to localStorage', () => {
    toggleXRayMode();
    expect(isXRayModeEnabled()).toBe(true);
    expect(window.localStorage.getItem('seer-xray-mode-enabled')).toBe('1');

    toggleXRayMode();
    expect(isXRayModeEnabled()).toBe(false);
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
