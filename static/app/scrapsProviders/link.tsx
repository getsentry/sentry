import {useMemo} from 'react';
import {matchRoutes, Link as RouterLink, type To} from 'react-router-dom';
import * as Sentry from '@sentry/react';

import type {LinkProps} from '@sentry/scraps/link';
import {LinkBehaviorContextProvider} from '@sentry/scraps/link/linkBehaviorContext';

import {PRELOAD_HANDLE} from 'sentry/router/preload';
import {locationDescriptorToTo} from 'sentry/utils/reactRouter6Compat/location';
import normalizeUrl from 'sentry/utils/url/normalizeUrl';
import {useLocation} from 'sentry/utils/useLocation';

export function SentryLinkBehaviorProvider({children}: {children: React.ReactNode}) {
  const location = useLocation();

  return (
    <LinkBehaviorContextProvider
      value={useMemo(
        () => ({
          component: RouterLink,
          behavior: ({to, onMouseEnter, onFocus, ...props}: LinkProps) => {
            const normalizedTo = locationDescriptorToTo(normalizeUrl(to, location));

            return {
              to: normalizedTo,
              onMouseEnter: e => {
                onMouseEnter?.(e);
                void preload(normalizedTo);
              },
              onFocus: e => {
                onFocus?.(e);
                void preload(normalizedTo);
              },
              ...props,
            };
          },
        }),
        [location]
      )}
    >
      {children}
    </LinkBehaviorContextProvider>
  );
}

async function preload(to: To) {
  // Try to match the route and preload if it has a preload method
  try {
    const routeConfig = (await import('sentry/routes')).routes();
    const matches = matchRoutes(routeConfig, to);

    if (matches && matches.length > 0) {
      // Preload all matching routes, not just the last one
      for (const match of matches) {
        const routeHandle = match.route.handle;

        // Check if the handle has a preload method
        if (
          routeHandle &&
          typeof routeHandle === 'object' &&
          PRELOAD_HANDLE in routeHandle
        ) {
          routeHandle[PRELOAD_HANDLE]?.().catch((error: unknown) => {
            Sentry.withScope(scope => {
              scope.setLevel('warning');
              Sentry.captureException(error, {
                tags: {
                  component: 'Link',
                  operation: 'preload',
                },
                extra: {
                  to,
                  route: match.route.path,
                },
              });
            });
          });
        }
      }
    }
  } catch (error) {
    Sentry.withScope(scope => {
      scope.setLevel('warning');
      Sentry.captureException(error, {
        tags: {
          component: 'Link',
          operation: 'route_matching',
        },
        extra: {
          to,
        },
      });
    });
  }
}
