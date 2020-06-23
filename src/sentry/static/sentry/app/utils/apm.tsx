import * as Router from 'react-router';
import {createMemoryHistory} from 'history';
import * as Sentry from '@sentry/react';

import getRouteStringFromRoutes from 'app/utils/getRouteStringFromRoutes';

const createLocation = createMemoryHistory().createLocation;

/**
 * Sets the transaction name
 */
export function setTransactionName(name: string) {
  Sentry.configureScope(scope => {
    scope.setTransaction(name);
    scope.setTag('ui.route', name);
  });
}

export function normalizeTransactionName(
  appRoutes: Router.PlainRoute[],
  location: Location
): string {
  const defaultName = location.pathname;
  // For JavaScript transactions, translate the transaction name if it exists and doesn't start with /
  // using the app's react-router routes. If the transaction name doesn't exist, use the window.location.pathname
  // as the fallback.
  Router.match(
    {
      routes: appRoutes,
      location: createLocation(location.pathname),
    },
    (error, _redirectLocation, renderProps) => {
      if (error) {
        return defaultName;
      }

      const routePath = getRouteStringFromRoutes(renderProps?.routes ?? []);

      if (routePath.length === 0 || routePath === '/*') {
        return defaultName;
      }

      return routePath;
    }
  );

  return defaultName;
}
