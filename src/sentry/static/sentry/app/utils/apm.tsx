import * as Sentry from '@sentry/browser';
import * as Router from 'react-router';
import {createMemoryHistory} from 'history';
import set from 'lodash/set';

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

export async function normalizeTransactionName(
  appRoutes: Router.PlainRoute[],
  event: Sentry.Event
): Promise<Sentry.Event> {
  if (event.type !== 'transaction') {
    return event;
  }

  // For JavaScript transactions, translate the transaction name if it exists and doesn't start with /
  // using the app's react-router routes. If the transaction name doesn't exist, use the window.location.pathname
  // as the fallback.

  let prevTransactionName = event.transaction;

  if (typeof prevTransactionName === 'string' && prevTransactionName.length > 0) {
    if (prevTransactionName.startsWith('/')) {
      return event;
    }

    set(event, ['tags', 'transaction.rename.source'], 'existing transaction name');
  } else {
    set(event, ['tags', 'transaction.rename.source'], 'window.location.pathname');

    prevTransactionName = window.location.pathname;
  }

  const transactionName: string = await new Promise(function(resolve) {
    Router.match(
      {
        routes: appRoutes,
        location: createLocation(prevTransactionName),
      },
      (error, _redirectLocation, renderProps) => {
        if (error) {
          set(event, ['tags', 'transaction.rename.router-match'], 'error');
          return resolve(window.location.pathname);
        }

        set(event, ['tags', 'transaction.rename.router-match'], 'success');

        const routePath = getRouteStringFromRoutes(renderProps?.routes ?? []);

        if (routePath.length === 0 || routePath === '/*') {
          return resolve(window.location.pathname);
        }

        return resolve(routePath);
      }
    );
  });

  event.transaction = transactionName;

  set(event, ['tags', 'transaction.rename.before'], prevTransactionName);
  set(event, ['tags', 'transaction.rename.after'], transactionName);

  set(event, ['tags', 'ui.route'], transactionName);

  return event;
}
