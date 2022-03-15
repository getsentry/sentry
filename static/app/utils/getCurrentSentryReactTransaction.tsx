import * as Sentry from '@sentry/react';
import {Transaction} from '@sentry/types';

/**
 * Gets the current transaction, if one exists.
 */
export default function getCurrentSentryReactTransaction(): Transaction | undefined {
  return Sentry?.getCurrentHub()?.getScope()?.getTransaction();
}
