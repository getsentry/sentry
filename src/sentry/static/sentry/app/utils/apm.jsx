import * as Sentry from '@sentry/browser';
import {Integrations} from '@sentry/apm';

/**
 * Sets the transaction name
 */
export function setTransactionName(name) {
  Integrations.Tracing.updateTransactionName(name);
  Sentry.setTag('ui.route', name);
}
