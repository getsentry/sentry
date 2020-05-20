import * as Sentry from '@sentry/browser';
import * as Router from 'react-router';
import {createMemoryHistory} from 'history';

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
  if (event.type === 'transaction') {
    // For JavaScript transactions, translate the transaction name if it exists and doesn't start with /
    // using the app's react-router routes. If the transaction name doesn't exist, use the window.location.pathname
    // as the fallback.

    let prevTransactionName = event.transaction;

    if (typeof prevTransactionName === 'string') {
      if (prevTransactionName.startsWith('/')) {
        return event;
      }
    } else {
      prevTransactionName = window.location.pathname;
    }

    const transactionName: string | undefined = await new Promise(function(resolve) {
      Router.match(
        {
          routes: appRoutes,
          location: createLocation(prevTransactionName),
        },
        (error, _redirectLocation, renderProps) => {
          if (error) {
            return resolve(undefined);
          }

          const routePath = getRouteStringFromRoutes(renderProps.routes ?? []);
          return resolve(routePath);
        }
      );
    });

    if (typeof transactionName === 'string' && transactionName.length) {
      event.transaction = transactionName;

      if (event.tags) {
        event.tags['ui.route'] = transactionName;
      } else {
        event.tags = {
          'ui.route': transactionName,
        };
      }
    }
  }

  return event;
}
