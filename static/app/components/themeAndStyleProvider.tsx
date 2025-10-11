import {Fragment, lazy} from 'react';
import {createPortal} from 'react-dom';
import createCache from '@emotion/cache';
import type {Theme} from '@emotion/react';
import {CacheProvider, ThemeProvider} from '@emotion/react';

import {NODE_ENV} from 'sentry/constants';
import ConfigStore from 'sentry/stores/configStore';
import {useLegacyStore} from 'sentry/stores/useLegacyStore';
import GlobalStyles from 'sentry/styles/global';
import {useThemeSwitcher} from 'sentry/utils/theme/useThemeSwitcher';

const SentryComponentInspector =
  NODE_ENV === 'development'
    ? lazy(() =>
        import('sentry/stories/inspector/inspector').then(module => ({
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
  const theme = useThemeSwitcher();

  return (
    <ThemeProvider theme={theme as Theme}>
      <GlobalStyles isDark={config.theme === 'dark'} theme={theme as Theme} />
      <CacheProvider value={cache}>{children}</CacheProvider>
      {createPortal(
        <Fragment>
          <meta name="color-scheme" content={config.theme} />
          <meta name="theme-color" content={theme.sidebar.background} />
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
