import * as Sentry from '@sentry/react';

/**
 * Gets the current transaction, if one exists.
 */
export default function getCurrentSentryReactTransaction() {
  return Sentry?.getCurrentHub()
    ?.getScope()
    ?.getTransaction();
}
