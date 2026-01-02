import {ThemeProvider} from '@emotion/react';
import {ThemeFixture} from 'sentry-fixture/theme';

import {act, renderHook} from 'sentry-test/reactTestingLibrary';

import type {BreakpointSize} from 'sentry/utils/theme';

import {useActiveBreakpoint, useResponsivePropValue, type Responsive} from './styles';

const theme = ThemeFixture();

// Mock window.matchMedia
const mockMatchMedia = (matches: boolean) => ({
  matches,
  media: '',
  onchange: null,
  addListener: jest.fn(),
  removeListener: jest.fn(),
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
  dispatchEvent: jest.fn(),
});

// Helper function to create a wrapper with theme
const createWrapper = () => {
  return function Wrapper({children}: {children: React.ReactNode}) {
    return <ThemeProvider theme={theme}>{children}</ThemeProvider>;
  };
};

// Helper to set up media query mocks for specific breakpoints
const setupMediaQueries = (
  breakpointMatches: Partial<Record<BreakpointSize, boolean>>
) => {
  const originalMatchMedia = window.matchMedia;

  window.matchMedia = jest.fn((query: string) => {
    // Extract breakpoint from media query
    const breakpointMatch = query.match(/min-width:\s*(.+?)\)/);
    const breakpointValue = breakpointMatch?.[1];

    // Map breakpoint values to breakpoint names
    const breakpointName = Object.entries(theme.breakpoints).find(
      ([_, value]) => value === breakpointValue
    )?.[0];

    const matches = breakpointName
      ? (breakpointMatches[breakpointName as BreakpointSize] ?? false)
      : false;

    return mockMatchMedia(matches);
  });

  return () => {
    window.matchMedia = originalMatchMedia;
  };
};

describe('useResponsivePropValue', () => {
  it('returns identity for non-responsive values', () => {
    const {result} = renderHook(() => useResponsivePropValue('hello'), {
      wrapper: createWrapper(),
    });

    expect(result.current).toBe('hello');
  });

  it('window matches breakpoint = breakpoint value', () => {
    const cleanup = setupMediaQueries({
      xs: true,
      sm: true,
      md: true,
      lg: false,
    });

    const responsiveValue: Responsive<string> = {
      xs: 'extra-small',
      sm: 'small',
      md: 'medium',
    };

    const {result} = renderHook(() => useResponsivePropValue(responsiveValue), {
      wrapper: createWrapper(),
    });

    expect(result.current).toBe('medium');
    cleanup();
  });

  it('window > largest breakpoint = largest breakpoint value', () => {
    const cleanup = setupMediaQueries({
      lg: false,
      xl: true,
    });

    const responsiveValue: Responsive<string> = {
      xs: 'extra-small',
      sm: 'small',
      md: 'medium',
    };

    const {result} = renderHook(() => useResponsivePropValue(responsiveValue), {
      wrapper: createWrapper(),
    });

    expect(result.current).toBe('medium');
    cleanup();
  });

  it('window < smallest breakpoint = smallest breakpoint value', () => {
    const cleanup = setupMediaQueries({
      xs: true,
      sm: false,
    });

    const responsiveValue: Responsive<string> = {
      sm: 'small',
    };

    const {result} = renderHook(() => useResponsivePropValue(responsiveValue), {
      wrapper: createWrapper(),
    });

    expect(result.current).toBe('small');
    cleanup();
  });

  it('window > smallest breakpoint and < largest breakpoint = smallest matching breakpoint value', () => {
    const cleanup = setupMediaQueries({
      xs: false,
      sm: false,
      md: true,
      lg: false,
    });

    const responsiveValue: Responsive<string> = {
      sm: 'small',
      lg: 'large',
    };

    const {result} = renderHook(() => useResponsivePropValue(responsiveValue), {
      wrapper: createWrapper(),
    });

    expect(result.current).toBe('small');
    cleanup();
  });

  it('handles undefined values in breakpoint', () => {
    const cleanup = setupMediaQueries({
      xs: true,
      md: true,
    });

    const responsiveValue: Responsive<string> = {
      xs: 'small',
      sm: undefined,
      md: 'medium',
      lg: undefined,
    };

    const {result} = renderHook(() => useResponsivePropValue(responsiveValue), {
      wrapper: createWrapper(),
    });

    expect(result.current).toBe('medium');
    cleanup();
  });

  it('throws an error when no breakpoints are defined in responsive prop', () => {
    expect(() =>
      renderHook(() => useResponsivePropValue({}), {
        wrapper: createWrapper(),
      })
    ).toThrow('Responsive prop must contain at least one breakpoint');
  });
});

describe('useActiveBreakpoint', () => {
  // We use min-width, so the only breakpoint that will match will be xs.
  // Fallback to xs here mimics how we treat the smallest breakpoint in responsive props
  // by doing max-width and min-width and essentially establishing a min value.
  it('returns xs as fallback when no breakpoints match', () => {
    const cleanup = setupMediaQueries({
      xs: false,
      sm: false,
      md: false,
      lg: false,
      xl: false,
    });

    const {result} = renderHook(() => useActiveBreakpoint(), {
      wrapper: createWrapper(),
    });

    expect(result.current).toBe('2xs');
    cleanup();
  });

  it('returns the largest matching breakpoint', () => {
    const cleanup = setupMediaQueries({
      xs: true,
      sm: true,
      md: true,
      lg: false,
      xl: false,
    });

    const {result} = renderHook(() => useActiveBreakpoint(), {
      wrapper: createWrapper(),
    });

    expect(result.current).toBe('md');
    cleanup();
  });

  it('sets up media queries for all breakpoints', () => {
    const matchMediaSpy = jest.fn(() => mockMatchMedia(false));
    window.matchMedia = matchMediaSpy;

    renderHook(() => useActiveBreakpoint(), {
      wrapper: createWrapper(),
    });

    // Should create media queries for all breakpoints (in reverse order)
    expect(matchMediaSpy).toHaveBeenCalledTimes(Object.keys(theme.breakpoints).length);
    expect(matchMediaSpy).toHaveBeenCalledWith(`(min-width: ${theme.breakpoints.xl})`);
    expect(matchMediaSpy).toHaveBeenCalledWith(`(min-width: ${theme.breakpoints.lg})`);
    expect(matchMediaSpy).toHaveBeenCalledWith(`(min-width: ${theme.breakpoints.md})`);
    expect(matchMediaSpy).toHaveBeenCalledWith(`(min-width: ${theme.breakpoints.sm})`);
    expect(matchMediaSpy).toHaveBeenCalledWith(`(min-width: ${theme.breakpoints.xs})`);
    expect(matchMediaSpy).toHaveBeenCalledWith(
      `(min-width: ${theme.breakpoints['2xs']})`
    );
  });

  it('uses correct breakpoint order (largest first)', () => {
    const cleanup = setupMediaQueries({
      xs: true,
      sm: true,
      md: true,
      lg: true,
      xl: true,
    });

    const {result} = renderHook(() => useActiveBreakpoint(), {
      wrapper: createWrapper(),
    });

    // Should return xl (largest) when all are active
    expect(result.current).toBe('xl');
    cleanup();
  });

  it('updates value when media queries change', () => {
    const mediaQueryListeners: Record<string, Array<() => void>> = {};
    const mockQueries: Record<string, any> = {};

    // Set up mock that tracks listeners
    window.matchMedia = jest.fn((query: string) => {
      const mockQuery = {
        matches: query === `(min-width: ${theme.breakpoints.md})`,
        media: query,
        addEventListener: jest.fn((_event: string, listener: () => void) => {
          if (!mediaQueryListeners[query]) {
            mediaQueryListeners[query] = [];
          }
          mediaQueryListeners[query].push(listener);
        }),
        removeEventListener: jest.fn((_event: string, listener: () => void) => {
          if (mediaQueryListeners[query]) {
            mediaQueryListeners[query] = mediaQueryListeners[query].filter(
              l => l !== listener
            );
          }
        }),
        addListener: jest.fn(),
        removeListener: jest.fn(),
        dispatchEvent: jest.fn(),
        onchange: null,
      };

      mockQueries[query] = mockQuery;
      return mockQuery;
    });

    const {result} = renderHook(
      () => useResponsivePropValue({xs: 'small', md: 'medium', lg: 'large'}),
      {
        wrapper: createWrapper(),
      }
    );

    // Initially query matches 'medium'
    expect(result.current).toBe('medium');

    // Simulate large breakpoint becoming active
    act(() => {
      const mdQuery = `(min-width: ${theme.breakpoints.lg})`;
      if (mockQueries[mdQuery]) {
        mockQueries[mdQuery].matches = true;
      }

      // Trigger all listeners for the md query
      if (mediaQueryListeners[mdQuery]) {
        mediaQueryListeners[mdQuery].forEach(listener => listener());
      }
    });

    expect(result.current).toBe('large');
  });

  it('calls AbortController.abort() on unmount', () => {
    const addEventListener = jest.fn();

    const abortController = {
      abort: jest.fn(),
      signal: {
        aborted: false,
        onabort: jest.fn(),
      },
    } as unknown as AbortController;

    const mockAbortController = jest.fn(() => abortController);
    window.AbortController = mockAbortController;

    window.matchMedia = jest.fn(() => ({
      matches: false,
      media: '',
      addEventListener,
      removeEventListener: jest.fn(),
      addListener: jest.fn(),
      removeListener: jest.fn(),
      onchange: null,
      dispatchEvent: jest.fn(),
    }));

    const {unmount} = renderHook(
      () => useResponsivePropValue({xs: 'small', md: 'medium'}),
      {
        wrapper: createWrapper(),
      }
    );

    // Sets up listeners for all breakpoints
    expect(addEventListener).toHaveBeenCalledTimes(Object.keys(theme.breakpoints).length);
    unmount();
    // Removes listeners for all breakpoints
    expect(abortController.abort).toHaveBeenCalledTimes(1);
  });
});
