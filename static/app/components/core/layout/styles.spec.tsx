import {ThemeProvider} from '@emotion/react';
import {ThemeFixture} from 'sentry-fixture/theme';

import {act, renderHook} from 'sentry-test/reactTestingLibrary';

import {type Breakpoint, type Responsive, useResponsivePropValue} from './styles';

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
const setupMediaQueries = (breakpointMatches: Partial<Record<Breakpoint, boolean>>) => {
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
      ? (breakpointMatches[breakpointName as Breakpoint] ?? false)
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

  it('throws error for empty breakpoint objects', () => {
    expect(() => {
      renderHook(() => useResponsivePropValue({}), {
        wrapper: createWrapper(),
      });
    }).toThrow('A breakpoint object must have at least one defined value');
  });

  it('returns value for the largest matching breakpoint that matches', () => {
    const cleanup = setupMediaQueries({
      xs: true,
      sm: true,
      md: true,
      lg: false,
      xl: false,
    });

    const responsiveValue: Responsive<string> = {
      xs: 'extra-small',
      sm: 'small',
      md: 'medium',
      lg: 'large',
      xl: 'extra-large',
    };

    const {result} = renderHook(() => useResponsivePropValue(responsiveValue), {
      wrapper: createWrapper(),
    });

    expect(result.current).toBe('medium');
    cleanup();
  });

  // We return the smallest value because we use min-width media queries,
  // so the only way we don't match is if we are below the smallest breakpoint.
  it('returns value for xs breakpoint when no media queries match', () => {
    const cleanup = setupMediaQueries({});

    const responsiveValue: Responsive<string> = {
      xs: 'small',
      md: 'medium',
      lg: 'large',
    };

    const {result} = renderHook(() => useResponsivePropValue(responsiveValue), {
      wrapper: createWrapper(),
    });

    expect(result.current).toBe('small');
    cleanup();
  });

  it('skips undefined breakpoint values', () => {
    const cleanup = setupMediaQueries({
      xs: true,
      sm: true,
      md: true,
      lg: true,
      xl: true,
    });

    const {result} = renderHook(
      () => useResponsivePropValue({xs: 'extra-small', lg: 'large'}),
      {
        wrapper: createWrapper(),
      }
    );

    expect(result.current).toBe('large');
    cleanup();
  });

  it('handles sparse breakpoint objects', () => {
    const cleanup = setupMediaQueries({
      xs: false,
      sm: false,
      md: true,
      lg: false,
      xl: false,
    });

    const {result} = renderHook(() => useResponsivePropValue({md: 'medium-only'}), {
      wrapper: createWrapper(),
    });

    expect(result.current).toBe('medium-only');
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

  it('removes event listeners on unmount', () => {
    const addEventListenerSpy = jest.fn();
    const removeEventListenerSpy = jest.fn();

    window.matchMedia = jest.fn(() => ({
      matches: false,
      media: '',
      addEventListener: addEventListenerSpy,
      removeEventListener: removeEventListenerSpy,
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

    expect(addEventListenerSpy).toHaveBeenCalledTimes(2);
    unmount();
    expect(removeEventListenerSpy).toHaveBeenCalledTimes(2);
  });
});
