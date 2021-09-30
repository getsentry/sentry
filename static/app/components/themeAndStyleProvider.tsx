import {useEffect} from 'react';
import ReactDOM from 'react-dom';
import {cache} from '@emotion/css'; // eslint-disable-line emotion/no-vanilla
import {CacheProvider, ThemeProvider} from '@emotion/react'; // This is needed to set "speedy" = false (for percy)

import {loadPreferencesState} from 'app/actionCreators/preferences';
import GlobalStyles from 'app/styles/global';
import {Config} from 'app/types';
import {darkTheme, lightTheme} from 'app/utils/theme';
import withConfig from 'app/utils/withConfig';

type Props = {
  config: Config;
  children: React.ReactNode;
};

/**
 * Wraps children with emotions ThemeProvider reactively set a theme.
 *
 * Also injects the sentry GlobalStyles .
 */
function ThemeAndStyleProvider({children, config}: Props) {
  useEffect(() => void loadPreferencesState(), []);

  const theme = config.theme === 'dark' ? darkTheme : lightTheme;

  return (
    <ThemeProvider theme={theme}>
      <GlobalStyles isDark={config.theme === 'dark'} theme={theme} />
      <CacheProvider value={cache}>{children}</CacheProvider>
      {ReactDOM.createPortal(
        <meta name="color-scheme" content={config.theme} />,
        document.head
      )}
    </ThemeProvider>
  );
}

export default withConfig(ThemeAndStyleProvider);
