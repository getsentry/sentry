import {useMemo} from 'react';

import {LinkBehaviorContextProvider, type LinkProps} from '@sentry/scraps/link';

import {preload} from 'sentry/router/preload';
import {Link as RouterLink} from 'sentry/router/reactRouter';
import {useRouteConfig} from 'sentry/router/routeConfigContext';
import {locationDescriptorToTo} from 'sentry/utils/reactRouter6Compat/location';
import {normalizeUrl} from 'sentry/utils/url/normalizeUrl';

export function SentryLinkBehaviorProvider({children}: {children: React.ReactNode}) {
  const routeConfig = useRouteConfig();

  return (
    <LinkBehaviorContextProvider
      value={useMemo(
        () => ({
          component: RouterLink,
          behavior: ({to, onMouseEnter, onFocus, ...props}: LinkProps) => {
            const normalizedTo = locationDescriptorToTo(normalizeUrl(to));

            return {
              to: normalizedTo,
              onMouseEnter: e => {
                onMouseEnter?.(e);
                if (routeConfig) {
                  preload(routeConfig, normalizedTo);
                }
              },
              onFocus: e => {
                onFocus?.(e);
                if (routeConfig) {
                  preload(routeConfig, normalizedTo);
                }
              },
              ...props,
            };
          },
        }),
        [routeConfig]
      )}
    >
      {children}
    </LinkBehaviorContextProvider>
  );
}
