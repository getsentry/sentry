import {matchRoutes, type RouteObject, type To} from 'react-router-dom';
import * as Sentry from '@sentry/react';

export const PRELOAD_HANDLE = '_preload';

export function preload(routeConfig: RouteObject[], to: To) {
  // Try to match the route and preload if it has a preload method
  try {
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
