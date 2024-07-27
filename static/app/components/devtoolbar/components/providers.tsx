import type {ReactNode} from 'react';
import {useMemo} from 'react';
import createCache from '@emotion/cache';
import {CacheProvider, ThemeProvider} from '@emotion/react';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';

import {PortalContainerContext} from 'sentry/components/devtoolbar/hooks/usePortalContainerContext';
import {lightTheme} from 'sentry/utils/theme';

import {ConfigurationContextProvider} from '../hooks/useConfiguration';
import {ToolbarRouterContextProvider} from '../hooks/useToolbarRoute';
import {VisibilityContextProvider} from '../hooks/useVisibility';
import type {Configuration} from '../types';

interface Props {
  children: ReactNode;
  config: Configuration;
  portalContainer: Element;
  reactContainer: Element;
}

export default function Providers({
  children,
  config,
  portalContainer,
  reactContainer,
}: Props) {
  const queryClient = useMemo(() => new QueryClient({}), []);

  const myCache = useMemo(
    () =>
      createCache({
        key: 'sentry-devtools',
        stylisPlugins: [
          /* your plugins here */
        ],
        container: reactContainer,
        prepend: false,
      }),
    [reactContainer]
  );

  return (
    <PortalContainerContext.Provider value={portalContainer}>
      <CacheProvider value={myCache}>
        <ThemeProvider theme={lightTheme}>
          <ConfigurationContextProvider config={config}>
            <QueryClientProvider client={queryClient}>
              <VisibilityContextProvider>
                <ToolbarRouterContextProvider>{children}</ToolbarRouterContextProvider>
              </VisibilityContextProvider>
            </QueryClientProvider>
          </ConfigurationContextProvider>
        </ThemeProvider>
      </CacheProvider>
    </PortalContainerContext.Provider>
  );
}
