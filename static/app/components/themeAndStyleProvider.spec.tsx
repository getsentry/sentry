import {useTheme} from '@emotion/react';

import {renderHook} from 'sentry-test/reactTestingLibrary';
import {mockMatchMedia} from 'sentry-test/utils';

import {ThemeAndStyleProvider} from 'sentry/components/themeAndStyleProvider';

// framer-motion caches the prefers-reduced-motion singleton on first mount and never
// re-reads the media query. Override useReducedMotion to read from window.matchMedia
// directly so mockMatchMedia controls the behaviour in every test.
jest.mock('framer-motion', () => ({
  ...jest.requireActual('framer-motion'),
  useReducedMotion: () =>
    global.window?.matchMedia('(prefers-reduced-motion: reduce)').matches ?? false,
}));

describe('ThemeAndStyleProvider', () => {
  it('provides 0ms motion transitions when prefers-reduced-motion is enabled', () => {
    mockMatchMedia(true);

    const {result} = renderHook(useTheme, {wrapper: ThemeAndStyleProvider});
    const theme = result.current;

    for (const easing of ['smooth', 'snap', 'enter', 'exit', 'spring'] as const) {
      for (const duration of ['fast', 'moderate', 'slow'] as const) {
        expect(theme.motion[easing][duration]).toMatch(/^0ms/);
      }
    }
  });

  it('preserves original motion transitions when prefers-reduced-motion is disabled', () => {
    mockMatchMedia(false);

    const {result} = renderHook(useTheme, {wrapper: ThemeAndStyleProvider});
    const theme = result.current;

    for (const easing of ['smooth', 'snap', 'enter', 'exit', 'spring'] as const) {
      for (const duration of ['fast', 'moderate', 'slow'] as const) {
        expect(theme.motion[easing][duration]).not.toMatch(/^0ms/);
      }
    }
  });
});
