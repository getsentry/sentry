import * as Sentry from '@sentry/browser';
import type {Breadcrumb} from '@sentry/browser';

import {
  IGNORED_BREADCRUMB_FETCH_HOSTS,
  IGNORED_SPAN_NAMES,
  SENTRY_RELEASE_VERSION,
  SPA_DSN,
  SPA_MODE_ALLOW_URLS,
  SPA_MODE_TRACE_PROPAGATION_TARGETS,
} from 'sentry/constants/sdk';
import type {ClientConfig} from 'sentry/serviceWorker/worker/client-config';

let isInitialized = false;

let lastEventId: string | undefined;

/**
 * @public
 * @returns The last event id.
 */
export function getLastEventId(): string | undefined {
  return lastEventId;
}

export function initializeSentry({
  apmSampling,
  customerDomain,
  dsn,
  sentryConfig,
  userIdentity,
}: ClientConfig) {
  if (isInitialized) {
    return;
  }
  isInitialized = true;
  Sentry.init({
    allowUrls: SPA_DSN ? SPA_MODE_ALLOW_URLS : sentryConfig.allowUrls,
    dsn: SPA_DSN || dsn,
    release: SENTRY_RELEASE_VERSION ?? sentryConfig.release,
    environment: sentryConfig.environment,

    dataCollection: {},
    enableLogs: true,
    _experiments: {
      enableMetrics: true,
    },

    defaultIntegrations: false,

    beforeBreadcrumb(crumb) {
      return isFilteredBreadcrumb(crumb) ? null : crumb;
    },

    beforeSend(event, hint) {
      lastEventId = event.event_id || hint.event_id;

      return event;
    },

    ignoreErrors: [
      /**
       * There is a bug in Safari, that causes `AbortError` when fetch is
       * aborted, and you are in the middle of reading the response. In Chrome
       * and other browsers, it is handled gracefully, where in Safari, it
       * produces additional error, that is jumping outside of the original
       * Promise chain and bubbles up to the `unhandledRejection` handler, that
       * we then captures as error.
       *
       * Ref: https://bugs.webkit.org/show_bug.cgi?id=215771
       */
      /AbortError: Fetch is aborted/i,
      /AbortError: The operation was aborted/i,
      /AbortError: signal is aborted without reason/i,
      /AbortError: The user aborted a request/i,
    ],
    ignoreSpans: IGNORED_SPAN_NAMES,

    tracesSampleRate: apmSampling ?? 0,
    tracePropagationTargets: [
      'localhost',
      /^\//,
      ...(SPA_DSN
        ? SPA_MODE_TRACE_PROPAGATION_TARGETS
        : sentryConfig.tracePropagationTargets),
    ],
  });

  Sentry.addEventProcessor((event: Sentry.Event, _hint?: Sentry.EventHint) => {
    event.tags = event.tags || {};
    return event;
  });

  if (SENTRY_RELEASE_VERSION) {
    Sentry.setTag('sentry_version', SENTRY_RELEASE_VERSION);
  }

  if (userIdentity) {
    Sentry.setUser(userIdentity);
  }

  if (customerDomain) {
    Sentry.setTag('isCustomerDomain', 'yes');
    Sentry.setTag('customerDomain.organizationUrl', customerDomain.organizationUrl);
    Sentry.setTag('customerDomain.sentryUrl', customerDomain.sentryUrl);
    Sentry.setTag('customerDomain.subdomain', customerDomain.subdomain);
  }
}

function isFilteredBreadcrumb(crumb: Breadcrumb): boolean {
  // Ignore fetch/xhr requests to certain hosts
  const isFetch = crumb.category === 'fetch' || crumb.category === 'xhr';
  if (
    isFetch &&
    IGNORED_BREADCRUMB_FETCH_HOSTS.some(host => crumb.data?.url?.includes(host))
  ) {
    return true;
  }

  return false;
}
