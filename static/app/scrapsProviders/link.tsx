import {useMemo} from 'react';
import {createPath, Link as RouterLink} from 'react-router';

import {LinkBehaviorContextProvider, type LinkProps} from '@sentry/scraps/link';

import {legacyLocationDescriptorToTo} from 'sentry/router/legacy/location';
import {preload} from 'sentry/router/preload';
import {useRouteConfig} from 'sentry/router/routeConfigContext';
import {normalizeUrl} from 'sentry/utils/url/normalizeUrl';

function normalizeLinkDestination(to: LinkProps['to']) {
  return legacyLocationDescriptorToTo(normalizeUrl(to));
}

export function SentryLinkBehaviorProvider({children}: {children: React.ReactNode}) {
  const routeConfig = useRouteConfig();

  return (
    <LinkBehaviorContextProvider
      value={useMemo(
        () => ({
          component: RouterLink,
          resolveHref: to => {
            const normalizedTo = normalizeLinkDestination(to);
            return typeof normalizedTo === 'string'
              ? normalizedTo
              : createPath({...normalizedTo, pathname: normalizedTo.pathname ?? ''});
          },
          behavior: ({to, onMouseEnter, onFocus, ...props}: LinkProps) => {
            const normalizedTo = normalizeLinkDestination(to);

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
