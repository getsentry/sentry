import {ThemeFixture} from 'sentry-fixture/theme';

import {act, renderHookWithProviders} from 'sentry-test/reactTestingLibrary';

import {
  type Breakpoints,
  checkBreakpoints,
  useBreakpoints,
} from 'sentry/utils/useBreakpoints';

jest.unmock('@tanstack/react-pacer');

describe('checkBreakpoints', () => {
  it('returns true for active breakpoints', () => {
    const breakpoints: Breakpoints = {
      '2xs': '0px',
      xs: '0px',
      sm: '0px',
      md: '1px',
      lg: '2px',
      xl: '3px',
      '2xl': '4px',
    };

    expect(checkBreakpoints(breakpoints, 2)).toEqual({
      '2xs': true,
      xs: true,
      sm: true,
      md: true,
      lg: true,
      xl: false,
      '2xl': false,
    });
  });
});

describe('useBreakpoints', () => {
  const originalWidth = window.innerWidth;
  const theme = ThemeFixture();

  function resizeWindow(width: number) {
    act(() => {
      window.innerWidth = width;
      window.dispatchEvent(new Event('resize'));
    });
  }

  function advanceTime(ms: number) {
    act(() => jest.advanceTimersByTime(ms));
  }

  beforeEach(() => {
    jest.useFakeTimers();
    window.innerWidth = 0;
  });

  afterEach(() => {
    jest.useRealTimers();
    window.innerWidth = originalWidth;
  });

  it('returns the current breakpoints immediately on mount', () => {
    window.innerWidth = 1000;
    const {result} = renderHookWithProviders(useBreakpoints);

    expect(result.current).toEqual(checkBreakpoints(theme.breakpoints, 1000));
  });

  it('waits until 100 ms after the last resize before updating', () => {
    const {result} = renderHookWithProviders(useBreakpoints);
    const initialBreakpoints = result.current;

    resizeWindow(1000);
    advanceTime(99);
    expect(result.current).toBe(initialBreakpoints);

    // Another resize restarts the full debounce delay.
    resizeWindow(2000);
    advanceTime(99);
    expect(result.current).toBe(initialBreakpoints);

    advanceTime(1);
    expect(result.current).toEqual(checkBreakpoints(theme.breakpoints, 2000));

    // Resizing back must compare against the updated state.
    resizeWindow(0);
    advanceTime(100);
    expect(result.current).toEqual(initialBreakpoints);
  });

  it('preserves the result when the active breakpoints have not changed', () => {
    const {result} = renderHookWithProviders(useBreakpoints);
    const initialBreakpoints = result.current;

    resizeWindow(1);
    advanceTime(100);

    expect(result.current).toBe(initialBreakpoints);
  });

  it('cancels pending work and removes the resize listener on unmount', () => {
    const {unmount} = renderHookWithProviders(useBreakpoints);

    resizeWindow(2000);
    expect(jest.getTimerCount()).toBe(1);

    unmount();
    expect(jest.getTimerCount()).toBe(0);

    resizeWindow(1000);
    expect(jest.getTimerCount()).toBe(0);
  });
});
