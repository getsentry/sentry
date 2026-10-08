import {Fragment, lazy, useLayoutEffect, useRef} from 'react';
import {createPortal} from 'react-dom';
import createCache from '@emotion/cache';
import {CacheProvider, ThemeProvider} from '@emotion/react';
import * as stylex from '@stylexjs/stylex';

// The generated dark theme class is internal to scraps' StyleX setup.
// eslint-disable-next-line boundaries/dependencies
import {stylexDarkTheme} from '@sentry/scraps/theme/darkTheme';

import 'sentry/stylex.css';
import {printConsoleBanner} from 'sentry/bootstrap/printConsoleBanner';
import {NODE_ENV} from 'sentry/constants';
import {ConfigStore} from 'sentry/stores/configStore';
import {useLegacyStore} from 'sentry/stores/useLegacyStore';
import {GlobalStyles} from 'sentry/styles/global';
import {darkTheme, lightTheme} from 'sentry/utils/theme/theme';

const SentryComponentInspector =
  NODE_ENV === 'development'
    ? lazy(() =>
        import('sentry/components/inspector').then(module => ({
          default: module.SentryComponentInspector,
        }))
      )
    : null;

type Props = {
  children: React.ReactNode;
};

// XXX(epurkhiser): We create our own emotion cache object to disable the
// stylis prefixer plugin. This plugin does NOT use browserlist to determine
// what needs prefixed, just applies ALL prefixes.
//
// In 2022 prefixes are almost ubiquitously unnecessary
const cache = createCache({key: 'app', stylisPlugins: []});
// Compat disables :nth-child warning
cache.compat = true;

// StyleX variables default to the light theme on :root; the dark theme
// overrides them from the document element so portals pick it up too.
const darkThemeClassNames = stylex.props(stylexDarkTheme).className?.split(' ') ?? [];

/**
 * Wraps children with emotions ThemeProvider reactively set a theme.
 *
 * Also injects the sentry GlobalStyles .
 */
export function ThemeAndStyleProvider({children}: Props) {
  const config = useLegacyStore(ConfigStore);

  const theme = config.theme === 'dark' ? darkTheme : lightTheme;

  useLayoutEffect(() => {
    if (config.theme !== 'dark') {
      return;
    }
    document.documentElement.classList.add(...darkThemeClassNames);
    return () => document.documentElement.classList.remove(...darkThemeClassNames);
  }, [config.theme]);

  const didPrintBanner = useRef(false);
  // oxlint-disable-next-line react/refs
  if (!didPrintBanner.current && NODE_ENV !== 'development' && NODE_ENV !== 'test') {
    didPrintBanner.current = true;
    printConsoleBanner(theme.tokens.content.accent, theme.font.family.mono);
  }

  return (
    <ThemeProvider theme={theme}>
      <GlobalStyles theme={theme} />
      <CacheProvider value={cache}>{children}</CacheProvider>
      {createPortal(
        <Fragment>
          <meta name="color-scheme" content={config.theme} />
          <meta name="theme-color" content={theme.tokens.background.primary} />
        </Fragment>,
        document.head
      )}
      {/* Only render the inspector in development */}
      {NODE_ENV === 'development' && SentryComponentInspector ? (
        <SentryComponentInspector />
      ) : null}
    </ThemeProvider>
  );
}
