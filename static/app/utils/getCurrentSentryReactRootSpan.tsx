import * as Sentry from '@sentry/react';

/**
 * Gets the current root span, if one exists.
 */
export function getCurrentSentryReactRootSpan() {
  const span = Sentry.getActiveSpan();
  return span ? Sentry.getRootSpan(span) : undefined;
}
