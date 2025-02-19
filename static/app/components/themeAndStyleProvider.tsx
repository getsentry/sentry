import {Fragment, useEffect, useMemo} from 'react';
import {createPortal} from 'react-dom';
import createCache from '@emotion/cache';
import {CacheProvider, ThemeProvider} from '@emotion/react';

import {loadPreferencesState} from 'sentry/actionCreators/preferences';
import ConfigStore from 'sentry/stores/configStore';
import {useLegacyStore} from 'sentry/stores/useLegacyStore';
import GlobalStyles from 'sentry/styles/global';
import {darkTheme, lightTheme} from 'sentry/utils/theme';
import {useChonkTheme} from 'sentry/utils/theme/useChonkTheme';
import {useHotkeys} from 'sentry/utils/useHotkeys';

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
  // @TODO(jonasbadalic): the preferences state here seems related to just the sidebar collapse state
  useEffect(() => void loadPreferencesState(), []);

  const config = useLegacyStore(ConfigStore);
  const [chonkTheme] = useChonkTheme();

  // Theme toggle global shortcut
  const themeToggleHotkeys = useMemo(() => {
    return [
      {
        match: ['command+shift+1', 'ctrl+shift+1'],
        includeInputs: true,
        callback: () => {
          ConfigStore.set('theme', config.theme === 'light' ? 'dark' : 'light');
        },
      },
    ];
  }, [config.theme]);

  useHotkeys(themeToggleHotkeys);

  // Use default theme or chonk theme if set.
  let theme = config.theme === 'dark' ? darkTheme : lightTheme;
  if (chonkTheme) {
    theme = chonkTheme;
  }

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
