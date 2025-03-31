import {useMemo} from 'react';
import createCache from '@emotion/cache';
import {CacheProvider, ThemeProvider, useTheme} from '@emotion/react';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';

import {ConfigurationContextProvider} from '../hooks/useConfiguration';
import {ToolbarRouterContextProvider} from '../hooks/useToolbarRoute';
import {VisibilityContextProvider} from '../hooks/useVisibility';
import type {Configuration} from '../types';

import {FeatureFlagsContextProvider} from './featureFlags/featureFlagsContext';

interface Props {
  children: React.ReactNode;
  config: Configuration;
  container: ShadowRoot;
}

export default function Providers({children, config, container}: Props) {
  const theme = useTheme();
  const queryClient = useMemo(() => new QueryClient({}), []);

  const myCache = useMemo(
    () =>
      createCache({
        key: 'sentry-devtools',
        stylisPlugins: [
          /* your plugins here */
        ],
        container,
        prepend: false,
      }),
    [container]
  );

  return (
    <CacheProvider value={myCache}>
      <ThemeProvider theme={theme}>
        <ConfigurationContextProvider config={config}>
          <QueryClientProvider client={queryClient}>
            <VisibilityContextProvider>
              <ToolbarRouterContextProvider>
                <FeatureFlagsContextProvider>{children}</FeatureFlagsContextProvider>
              </ToolbarRouterContextProvider>
            </VisibilityContextProvider>
          </QueryClientProvider>
        </ConfigurationContextProvider>
      </ThemeProvider>
    </CacheProvider>
  );
}
