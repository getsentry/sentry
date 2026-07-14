import {type ReactNode, useRef} from 'react';
import {css} from '@emotion/react';
import {ThemeFixture} from 'sentry-fixture/theme';

import {
  act,
  render,
  renderHookWithProviders,
  screen,
} from 'sentry-test/reactTestingLibrary';

import {assert} from 'sentry/types/utils';
import type {BreakpointSize} from 'sentry/utils/theme';

import {
  ContainerQueryProvider,
  getBorder,
  rc,
  useActiveBreakpoint,
  useContainerBreakpoint,
  useResponsivePropValue,
  type Responsive,
  // eslint-disable-next-line boundaries/dependencies
} from './styles';

const theme = ThemeFixture();
const normalizeCss = (value: string) =>
  value
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)
    .join('\n');

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

describe('rc', () => {
  it('returns a simple CSS declaration for a plain string value', () => {
    const output = rc('color', 'red', theme);
    assert(output);
    expect(
      normalizeCss(
        css`
          ${output}
        `.styles
      )
    ).toEqual(normalizeCss(output));
  });

  it('returns undefined when value is undefined', () => {
    expect(rc('color', undefined, theme)).toBeUndefined();
  });

  it('applies a resolver to a plain value', () => {
    const output = rc('color', 'primary', theme, value => `resolved-${value}`);
    assert(output);
    expect(
      normalizeCss(
        css`
          ${output}
        `.styles
      )
    ).toEqual(normalizeCss(output));
  });

  it('returns undefined when resolver returns undefined for a plain value', () => {
    expect(rc('color', 'red', theme, () => {})).toBeUndefined();
  });

  it('generates media queries for responsive values', () => {
    // First defined breakpoint gets both min-width and max-width; subsequent get min-width only.
    const output = rc('color', {'screen:xs': 'blue', 'screen:md': 'green'}, theme);
    assert(output);
    expect(
      normalizeCss(
        css`
          ${output}
        `.styles
      )
    ).toEqual(normalizeCss(output));
  });

  it('skips undefined intermediate breakpoints', () => {
    // xs and md are defined; 2xs, sm, lg, xl, 2xl are absent from the output.
    const output = rc('font-size', {'screen:xs': 'md', 'screen:md': 'lg'}, theme);
    assert(output);
    expect(
      normalizeCss(
        css`
          ${output}
        `.styles
      )
    ).toEqual(normalizeCss(output));
  });

  it('emits @container queries for bare breakpoint keys', () => {
    // Bare keys (no prefix) resolve against the nearest query container.
    const output = rc('flex-direction', {xs: 'column', md: 'row'}, theme);
    assert(output);
    expect(output).toContain('@container');
    expect(output).not.toContain('@media');
    expect(output).toContain(`@container (min-width: ${theme.breakpoints.md})`);
  });

  it('emits @media queries for screen: breakpoint keys', () => {
    // `screen:`-prefixed keys resolve against the viewport.
    const output = rc(
      'flex-direction',
      {'screen:xs': 'column', 'screen:md': 'row'},
      theme
    );
    assert(output);
    expect(output).toContain('@media');
    expect(output).not.toContain('@container');
    expect(output).toContain(`@media (min-width: ${theme.breakpoints.md})`);
  });

  it('resolves the same prop against both the container and the viewport', () => {
    // Bare `xs` is the container base; `screen:lg` overrides at the viewport.
    const output = rc('flex-direction', {xs: 'column', 'screen:lg': 'row'}, theme);
    assert(output);
    // xs (smallest defined) is the always-applied base — a plain declaration.
    expect(output).toContain('flex-direction: column;');
    // and the viewport key emits an @media rule on top.
    expect(output).toContain(`@media (min-width: ${theme.breakpoints.lg})`);
    expect(output).toContain('flex-direction: row;');
  });

  it('emits the first defined breakpoint as a plain declaration', () => {
    // The base value applies unconditionally (not wrapped in a query) so it
    // still applies when no container is present.
    const output = rc('flex-direction', {xs: 'column', md: 'row'}, theme);
    assert(output);
    // xs (the base) is a bare declaration, not inside an at-rule.
    expect(output).toContain('flex-direction: column;');
    expect(output).not.toContain(`(min-width: ${theme.breakpoints.xs})`);
  });

  it('returns a plain declaration (no at-rule) for non-responsive values', () => {
    expect(rc('container-type', 'inline-size', theme)).toBe(
      'container-type: inline-size;'
    );
    expect(rc('container-type', undefined, theme)).toBeUndefined();
  });
});

describe('getBorder', () => {
  it('resolves a border variant to a full declaration', () => {
    expect(getBorder('primary', undefined, theme)).toBe(
      `1px solid ${theme.tokens.border.primary}`
    );
  });

  it('returns "none" so a border can be turned off responsively', () => {
    expect(getBorder('none', undefined, theme)).toBe('none');
  });

  it('returns undefined when omitted', () => {
    expect(getBorder(undefined, undefined, theme)).toBeUndefined();
  });

  it('lets a responsive border move sides across breakpoints', () => {
    const output = rc('border-bottom', {'2xs': 'primary', lg: 'none'}, theme, getBorder);
    assert(output);
    // Present below lg…
    expect(output).toContain(`border-bottom: 1px solid ${theme.tokens.border.primary}`);
    // …and explicitly removed at lg via `none`.
    expect(output).toContain(`@container (min-width: ${theme.breakpoints.lg})`);
    expect(output).toContain('border-bottom: none');
  });
});

describe('useResponsivePropValue', () => {
  it('returns identity for non-responsive values', () => {
    const {result} = renderHookWithProviders(() => useResponsivePropValue('hello'));

    expect(result.current).toBe('hello');
  });

  it('falls back to the base breakpoint for container keys with no container ancestor', () => {
    // Bare keys resolve against the nearest container; with no ContainerQueryProvider
    // in the tree they resolve to the base ('2xs') — the only value the CSS applies
    // (the plain base declaration), so JS and CSS agree instead of JS drifting.
    const {result} = renderHookWithProviders(() =>
      useResponsivePropValue({'2xs': 'base', md: 'medium'})
    );

    expect(result.current).toBe('base');
  });

  it('resolves the same prop against both container and viewport', () => {
    // Bare `2xs` is the container base; `screen:lg` overrides once the viewport
    // reaches lg. With the viewport at lg (and no container), the viewport wins.
    const cleanup = setupMediaQueries({xs: true, sm: true, md: true, lg: true});

    const {result} = renderHookWithProviders(() =>
      useResponsivePropValue({'2xs': 'container-base', 'screen:lg': 'viewport-large'})
    );

    expect(result.current).toBe('viewport-large');
    cleanup();
  });

  it('keeps the container base when the viewport key does not match', () => {
    const cleanup = setupMediaQueries({xs: false, sm: false, md: false, lg: false});

    const {result} = renderHookWithProviders(() =>
      useResponsivePropValue({'2xs': 'container-base', 'screen:lg': 'viewport-large'})
    );

    expect(result.current).toBe('container-base');
    cleanup();
  });

  it('window matches breakpoint = breakpoint value', () => {
    const cleanup = setupMediaQueries({
      xs: true,
      sm: true,
      md: true,
      lg: false,
    });

    const responsiveValue: Responsive<string> = {
      'screen:xs': 'extra-small',
      'screen:sm': 'small',
      'screen:md': 'medium',
    };

    const {result} = renderHookWithProviders(() =>
      useResponsivePropValue(responsiveValue)
    );

    expect(result.current).toBe('medium');
    cleanup();
  });

  it('window > largest breakpoint = largest breakpoint value', () => {
    const cleanup = setupMediaQueries({
      lg: false,
      xl: true,
    });

    const responsiveValue: Responsive<string> = {
      'screen:xs': 'extra-small',
      'screen:sm': 'small',
      'screen:md': 'medium',
    };

    const {result} = renderHookWithProviders(() =>
      useResponsivePropValue(responsiveValue)
    );

    expect(result.current).toBe('medium');
    cleanup();
  });

  it('window < smallest breakpoint = smallest breakpoint value', () => {
    const cleanup = setupMediaQueries({
      xs: true,
      sm: false,
    });

    const responsiveValue: Responsive<string> = {
      'screen:sm': 'small',
    };

    const {result} = renderHookWithProviders(() =>
      useResponsivePropValue(responsiveValue)
    );

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
      'screen:sm': 'small',
      'screen:lg': 'large',
    };

    const {result} = renderHookWithProviders(() =>
      useResponsivePropValue(responsiveValue)
    );

    expect(result.current).toBe('small');
    cleanup();
  });

  it('handles undefined values in breakpoint', () => {
    const cleanup = setupMediaQueries({
      xs: true,
      md: true,
    });

    const responsiveValue: Responsive<string> = {
      'screen:xs': 'small',
      'screen:sm': undefined,
      'screen:md': 'medium',
      'screen:lg': undefined,
    };

    const {result} = renderHookWithProviders(() =>
      useResponsivePropValue(responsiveValue)
    );

    expect(result.current).toBe('medium');
    cleanup();
  });

  it('throws an error when no breakpoints are defined in responsive prop', () => {
    expect(() => renderHookWithProviders(() => useResponsivePropValue({}))).toThrow(
      'Responsive prop must contain at least one breakpoint'
    );
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

    const {result} = renderHookWithProviders(() => useActiveBreakpoint());

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

    const {result} = renderHookWithProviders(() => useActiveBreakpoint());

    expect(result.current).toBe('md');
    cleanup();
  });

  it('sets up media queries for all breakpoints', () => {
    const matchMediaSpy = jest.fn(() => mockMatchMedia(false));
    window.matchMedia = matchMediaSpy;

    renderHookWithProviders(() => useActiveBreakpoint());

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

    const {result} = renderHookWithProviders(() => useActiveBreakpoint());

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

    const {result} = renderHookWithProviders(() =>
      useResponsivePropValue({
        'screen:xs': 'small',
        'screen:md': 'medium',
        'screen:lg': 'large',
      })
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

    const {unmount} = renderHookWithProviders(() =>
      useResponsivePropValue({'screen:xs': 'small', 'screen:md': 'medium'})
    );

    // Sets up listeners for all breakpoints
    expect(addEventListener).toHaveBeenCalledTimes(Object.keys(theme.breakpoints).length);
    unmount();
    // Removes listeners for all breakpoints
    expect(abortController.abort).toHaveBeenCalledTimes(1);
  });
});

describe('useContainerBreakpoint', () => {
  class MockResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  }

  let originalResizeObserver: typeof window.ResizeObserver;

  beforeEach(() => {
    originalResizeObserver = window.ResizeObserver;
    window.ResizeObserver = MockResizeObserver as unknown as typeof window.ResizeObserver;
  });

  afterEach(() => {
    window.ResizeObserver = originalResizeObserver;
    jest.restoreAllMocks();
  });

  // `clientWidth` is an accessor on Element.prototype (not HTMLElement); spy
  // there so the fake is actually hit and restoreAllMocks cleans it up.
  const setClientWidth = (width: number) => {
    jest.spyOn(Element.prototype, 'clientWidth', 'get').mockReturnValue(width);
  };

  // The hook reads the nearest query container's size from context, so render
  // the probe inside a ContainerQueryProvider whose measured element reports the
  // faked width.
  function BreakpointProbe() {
    const breakpoint = useContainerBreakpoint();
    return <div>breakpoint:{breakpoint}</div>;
  }

  function Container({children}: {children: ReactNode}) {
    const ref = useRef<HTMLDivElement>(null);
    return (
      <ContainerQueryProvider elementRef={ref}>
        <div ref={ref}>{children}</div>
      </ContainerQueryProvider>
    );
  }

  it('resolves the largest breakpoint the container width satisfies', () => {
    // md = 992px, lg = 1200px -> 1000px resolves to md.
    setClientWidth(1000);
    render(
      <Container>
        <BreakpointProbe />
      </Container>
    );
    expect(screen.getByText('breakpoint:md')).toBeInTheDocument();
  });

  it('falls back to 2xs when the container is narrower than the smallest breakpoint', () => {
    setClientWidth(0);
    render(
      <Container>
        <BreakpointProbe />
      </Container>
    );
    expect(screen.getByText('breakpoint:2xs')).toBeInTheDocument();
  });
});
