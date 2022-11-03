import {Fragment, useEffect} from 'react';
import {createPortal} from 'react-dom';
import createCache from '@emotion/cache';
import {CacheProvider, ThemeProvider} from '@emotion/react';

import {loadPreferencesState} from 'sentry/actionCreators/preferences';
import ConfigStore from 'sentry/stores/configStore';
import {useLegacyStore} from 'sentry/stores/useLegacyStore';
import GlobalStyles from 'sentry/styles/global';
import {darkTheme, lightTheme} from 'sentry/utils/theme';

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
function ThemeAndStyleProvider({children}: Props) {
  useEffect(() => void loadPreferencesState(), []);

  const config = useLegacyStore(ConfigStore);
  const theme = config.theme === 'dark' ? darkTheme : lightTheme;

  return (
    <ThemeProvider theme={theme}>
      <GlobalStyles isDark={config.theme === 'dark'} theme={theme} />
      <CacheProvider value={cache}>{children}</CacheProvider>
      {createPortal(
        <Fragment>
          <meta name="color-scheme" content={config.theme} />
          <meta name="theme-color" content={theme.sidebar.background} />
        </Fragment>,
        document.head
      )}
    </ThemeProvider>
  );
}

export default ThemeAndStyleProvider;
