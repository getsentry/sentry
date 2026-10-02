import * as Sentry from '@sentry/react';

import {matchRoutes, type RouteObject, type To} from 'sentry/router/reactRouter';

export const PRELOAD_HANDLE = '_preload';

export function preload(routeConfig: RouteObject[], to: To) {
  try {
    const matches = matchRoutes(routeConfig, to);

    if (matches && matches.length > 0) {
      for (const match of matches) {
        const routeHandle = match.route.handle;

        if (
          routeHandle &&
          typeof routeHandle === 'object' &&
          PRELOAD_HANDLE in routeHandle
        ) {
          routeHandle[PRELOAD_HANDLE]?.().catch((error: unknown) => {
            Sentry.logger.warn(`Preload failed for route: ${match.route.path}`, {error});
          });
        }
      }
    }
  } catch (error) {
    Sentry.logger.warn('Error during route preloading', {error});
  }
}
