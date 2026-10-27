import {Fragment, lazy, useRef} from 'react';
import {createPortal} from 'react-dom';
import createCache from '@emotion/cache';
import {CacheProvider, ThemeProvider} from '@emotion/react';
import {useSelector} from '@tanstack/react-store';

import {darkTheme, lightTheme} from '@sentry/scraps/theme';

import {printConsoleBanner} from 'sentry/bootstrap/printConsoleBanner';
import {NODE_ENV} from 'sentry/constants';
import {ConfigStore} from 'sentry/stores/configStore';
import {GlobalStyles} from 'sentry/styles/global';

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

/**
 * Wraps children with emotions ThemeProvider reactively set a theme.
 *
 * Also injects the sentry GlobalStyles .
 */
export function ThemeAndStyleProvider({children}: Props) {
  const colorMode = useSelector(ConfigStore.store, state => state.theme);

  const theme = colorMode === 'dark' ? darkTheme : lightTheme;

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
          <meta name="color-scheme" content={colorMode} />
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
