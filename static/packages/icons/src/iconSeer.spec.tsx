import {screen} from '@testing-library/react';

describe('IconSeer', () => {
  const originalCss = globalThis.CSS;
  const originalMatchMedia = window.matchMedia;
  const originalUserAgent = navigator.userAgent;

  afterEach(() => {
    Object.defineProperty(globalThis, 'CSS', {configurable: true, value: originalCss});
    window.matchMedia = originalMatchMedia;
    Object.defineProperty(navigator, 'userAgent', {
      configurable: true,
      value: originalUserAgent,
    });
    jest.restoreAllMocks();
  });

  it.each([
    {
      animation: undefined,
      supported: true,
      safari: false,
      reduced: false,
      expected: 'static',
    },
    {animation: 'idle', supported: true, safari: false, reduced: false, expected: 'idle'},
    {
      animation: 'loading',
      supported: true,
      safari: false,
      reduced: false,
      expected: 'loading',
    },
    {
      animation: 'loading',
      supported: false,
      safari: false,
      reduced: false,
      expected: 'idle',
    },
    {
      animation: 'loading',
      supported: true,
      safari: true,
      reduced: false,
      expected: 'idle',
    },
    {
      animation: 'idle',
      supported: true,
      safari: false,
      reduced: true,
      expected: 'static',
    },
    {
      animation: 'loading',
      supported: true,
      safari: false,
      reduced: true,
      expected: 'static',
    },
  ] as const)(
    'renders $animation as $expected (CSS: $supported, Safari: $safari, reduced motion: $reduced)',
    async ({animation, supported, safari, reduced, expected}) => {
      Object.defineProperty(globalThis, 'CSS', {
        configurable: true,
        value: {supports: () => supported},
      });
      Object.defineProperty(navigator, 'userAgent', {
        configurable: true,
        value: safari ? 'Version/18 Safari/605.1' : 'Chrome/130 Safari/537.36',
      });
      window.matchMedia = jest.fn().mockImplementation((query: string) => ({
        matches: reduced,
        media: query,
        addListener: jest.fn(),
        removeListener: jest.fn(),
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
      }));
      // Framer Motion emits this warning when the browser requests reduced motion.
      const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});

      // Capability detection and Framer Motion's preference are cached at module
      // load. Load a fresh renderer and icon together for each browser setting.
      await jest.isolateModulesAsync(async () => {
        const {createElement} = await import('react');
        const {render, cleanup} = await import('@testing-library/react/pure');
        const {IconSeer} = await import('./iconSeer');
        try {
          render(createElement(IconSeer, {animation}));
          const icon = screen.getByRole('img');
          expect(icon).toHaveAttribute(
            'viewBox',
            expected === 'loading' ? '0 0 32 32' : '0 0 16 16'
          );
          if (expected === 'idle') {
            expect(icon).toHaveTextContent('seerIdle');
          } else if (expected === 'loading') {
            expect(icon).toHaveTextContent('seerSwA');
            expect(icon).toHaveAttribute('stroke', 'currentColor');
          } else {
            expect(icon).not.toHaveTextContent(/seerIdle|seerSwA/);
          }
          if (reduced) {
            expect(warn).toHaveBeenCalledWith(expect.stringContaining('Reduced Motion'));
          } else {
            expect(warn).not.toHaveBeenCalled();
          }
        } finally {
          cleanup();
        }
      });
    }
  );
});
