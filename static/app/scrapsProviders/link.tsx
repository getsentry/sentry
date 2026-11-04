import {useMemo} from 'react';
import {Link as RouterLink} from 'react-router';

import {LinkBehaviorContextProvider, type LinkProps} from '@sentry/scraps/link';

import {legacyLocationDescriptorToTo} from 'sentry/router/legacy/location';
import {preload} from 'sentry/router/preload';
import {useRouteConfig} from 'sentry/router/routeConfigContext';
import {normalizeUrl} from 'sentry/utils/url/normalizeUrl';

export function SentryLinkBehaviorProvider({children}: {children: React.ReactNode}) {
  const routeConfig = useRouteConfig();

  return (
    <LinkBehaviorContextProvider
      value={useMemo(
        () => ({
          component: RouterLink,
          behavior: ({to, onMouseEnter, onFocus, ...props}: LinkProps) => {
            const normalizedTo = legacyLocationDescriptorToTo(normalizeUrl(to));

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
