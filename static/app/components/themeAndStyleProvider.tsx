import {Fragment, lazy, useMemo, useRef} from 'react';
import {createPortal} from 'react-dom';
import createCache from '@emotion/cache';
import {CacheProvider, ThemeProvider} from '@emotion/react';

import printConsoleBanner from 'sentry/bootstrap/printConsoleBanner';
import {NODE_ENV} from 'sentry/constants';
import ConfigStore from 'sentry/stores/configStore';
import {useLegacyStore} from 'sentry/stores/useLegacyStore';
import GlobalStyles from 'sentry/styles/global';
import {removeBodyTheme} from 'sentry/utils/removeBodyTheme';
// eslint-disable-next-line no-restricted-imports
import {darkTheme, lightTheme} from 'sentry/utils/theme/theme';
import {useHotkeys} from 'sentry/utils/useHotkeys';

const SentryComponentInspector =
  NODE_ENV === 'development'
    ? lazy(() =>
        import('sentry/components/core/inspector').then(module => ({
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
  const config = useLegacyStore(ConfigStore);

  // Hotkey definition for toggling the current theme
  const themeToggleHotkey = useMemo(
    () => [
      {
        match: ['command+shift+1', 'ctrl+shift+1'],
        includeInputs: true,
        callback: () => {
          removeBodyTheme();
          ConfigStore.set('theme', config.theme === 'dark' ? 'light' : 'dark');
        },
      },
    ],
    [config.theme]
  );

  useHotkeys(themeToggleHotkey);

  const theme = config.theme === 'dark' ? darkTheme : lightTheme;

  const didPrintBanner = useRef(false);
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
