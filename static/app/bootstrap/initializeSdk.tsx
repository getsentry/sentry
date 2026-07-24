import {useEffect} from 'react';
import {
  createRoutesFromChildren,
  matchRoutes,
  useLocation,
  useNavigationType,
} from 'react-router-dom';
import {type Event, type Log} from '@sentry/core';
import * as Sentry from '@sentry/react';

import {NODE_ENV} from 'sentry/constants';
import {
  IGNORED_BREADCRUMB_FETCH_HOSTS,
  IGNORED_SPAN_NAMES,
  SENTRY_RELEASE_VERSION,
  SPA_DSN,
  SPA_MODE_ALLOW_URLS,
  SPA_MODE_TRACE_PROPAGATION_TARGETS,
} from 'sentry/constants/sdk';
import type {Config} from 'sentry/types/system';
import {addUIElementTagToSegmentSpan} from 'sentry/utils/performanceForSentry';
import {normalizeUrl} from 'sentry/utils/url/normalizeUrl';

let lastEventId: string | undefined;

export function getLastEventId(): string | undefined {
  return lastEventId;
}

// Each error type maps to the set of HTTP status codes it should be filtered for.
const FILTERED_STATUSES_BY_ERROR_TYPE: Readonly<Record<string, ReadonlySet<string>>> = {
  RequestError: new Set(['200', '400', '401', '403', '404', '429']),
  BadRequestError: new Set(['400']),
  UnauthorizedError: new Set(['401']),
  ForbiddenError: new Set(['403']),
  NotFoundError: new Set(['404']),
  TooManyRequestsError: new Set(['429']),
};
const FILTERED_REQUEST_ERROR_VALUE_REGEX = /^(GET|POST|PUT|DELETE) .* (\d+)$/;

const ENDPOINT_TAG_REGEX = /^([A-Za-z]+ (\/[^/]+)+\/) \d+$/;

/**
 * Check if the message is from the console banner in `static/app/bootstrap/printConsoleBanner.ts`.
 * Used to filter it from both breadcrumbs and logs.
 */
function isConsoleBannerMessage(message: string | undefined): boolean {
  return !!message?.includes('Hey, you opened the console!');
}

// We check for `window.__initialData.user` property and only enable profiling
// for Sentry employees. This is to prevent a Violation error being visible in
// the browser console for our users.
const shouldOverrideBrowserProfiling = window?.__initialData?.user?.isSuperuser;
function getSentryIntegrations() {
  const integrations = [
    Sentry.spanStreamingIntegration(),
    Sentry.extraErrorDataIntegration({
      // 6 is arbitrary, seems like a nice number
      depth: 6,
    }),
    Sentry.reactRouterV6BrowserTracingIntegration({
      useEffect,
      useLocation,
      useNavigationType,
      createRoutesFromChildren,
      matchRoutes,
      _experiments: {
        enableStandaloneClsSpans: true,
        enableStandaloneLcpSpans: true,
      },
      linkPreviousTrace: 'session-storage',
    }),
    ...(NODE_ENV === 'production' ? [Sentry.browserProfilingIntegration()] : []),
    Sentry.thirdPartyErrorFilterIntegration({
      filterKeys: ['sentry-spa'],
      behaviour: 'apply-tag-if-contains-third-party-frames',
    }),
    Sentry.featureFlagsIntegration(),
    Sentry.consoleLoggingIntegration(),
  ];

  return integrations;
}

/**
 * Initialize the Sentry SDK
 *
 * If `routes` is passed, we will instrument react-router. Not all
 * entrypoints require this.
 */
export function initializeSdk(config: Config) {
  // NOTE: This config is mutated by `commonInitialization`
  const {apmSampling, customerDomain, sentryConfig, userIdentity} = config;
  const tracesSampleRate = apmSampling ?? 0;
  const extraTracePropagationTargets = SPA_DSN
    ? SPA_MODE_TRACE_PROPAGATION_TARGETS
    : [...sentryConfig.tracePropagationTargets];

  const sentryClient = Sentry.init({
    ...sentryConfig,
    /**
     * For SPA mode, we need a way to overwrite the default DSN from backend
     * as well as `allowUrls`
     */
    dsn: SPA_DSN || sentryConfig?.dsn,
    /**
     * Frontend can be built with a `SENTRY_RELEASE_VERSION` environment
     * variable for release string, useful if frontend is deployed separately
     * from backend.
     */
    release: SENTRY_RELEASE_VERSION ?? sentryConfig?.release,
    allowUrls: SPA_DSN ? SPA_MODE_ALLOW_URLS : sentryConfig?.allowUrls,
    integrations: getSentryIntegrations(),
    tracesSampleRate,
    profileSessionSampleRate: shouldOverrideBrowserProfiling ? 1 : 0.1,
    profileLifecycle: 'trace',
    tracePropagationTargets: ['localhost', /^\//, ...extraTracePropagationTargets],
    tracesSampler: context => {
      const op = context.attributes?.[Sentry.SEMANTIC_ATTRIBUTE_SENTRY_OP] || '';
      if (op.startsWith('ui.action')) {
        return context.inheritOrSampleWith(tracesSampleRate / 100);
      }
      return context.inheritOrSampleWith(tracesSampleRate);
    },
    ignoreSpans: IGNORED_SPAN_NAMES,

    beforeSendSpan: Sentry.withStreamedSpan(span => {
      const op = span.attributes?.['sentry.op'];
      if (span.name && (op === 'pageload' || op === 'navigation')) {
        span.name = normalizeUrl(span.name, {forceCustomerDomain: true});
      }

      return span;
    }),

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
      /**
       * Script https://org-slug.sentry.io/service-worker.js load failed
       * ServiceWorker script at https://org-slug.sentry.io/service-worker.js
       *   encountered an error during installation.
       * Failed to register a ServiceWorker with script
       *   https://org-slug.sentry.io/service-worker.js: unsupported MIME type
       */
      /service-worker\.js.*(?:load failed|error during installation|unsupported MIME type)/i,
      /**
       * React internal error thrown when something outside react modifies the DOM
       * This is usually because of a browser extension or chrome translate page
       */
      "NotFoundError: Failed to execute 'removeChild' on 'Node': The node to be removed is not a child of this node.",
      "NotFoundError: Failed to execute 'insertBefore' on 'Node': The node before which the new node is to be inserted is not a child of this node.",
    ],

    beforeBreadcrumb(crumb) {
      const isFetch = crumb.category === 'fetch' || crumb.category === 'xhr';

      // Ignore fetch/xhr requests to certain hosts
      if (
        isFetch &&
        IGNORED_BREADCRUMB_FETCH_HOSTS.some(host => crumb.data?.url?.includes(host))
      ) {
        return null;
      }

      // Ignore the console banner
      if (crumb.category === 'console' && isConsoleBannerMessage(crumb.message)) {
        return null;
      }

      return crumb;
    },

    beforeSend(event, hint) {
      if (
        isFilteredRequestErrorEvent(event) ||
        isEventWithFileUrl(event) ||
        isNullTupleUnhandledRejectionEvent(hint)
      ) {
        return null;
      }

      handlePossibleUndefinedResponseBodyErrors(event);
      addEndpointTagToRequestError(event);
      lastEventId = event.event_id || hint.event_id;

      return event;
    },

    beforeSendLog: log => {
      if (isFilteredLog(log)) {
        return null;
      }

      return log;
    },

    enableLogs: true,
    dataCollection: {},
    _experiments: {
      enableMetrics: true,
    },
  });

  // Track timeOrigin Selection by the SDK to see if it improves transaction durations
  Sentry.addEventProcessor((event: Sentry.Event, _hint?: Sentry.EventHint) => {
    event.tags = event.tags || {};
    return event;
  });

  if (userIdentity) {
    Sentry.setUser(userIdentity);
  }
  if (window.__SENTRY__VERSION) {
    Sentry.setTag('sentry_version', window.__SENTRY__VERSION);
    Sentry.setAttribute('sentry_version', window.__SENTRY__VERSION);
  }

  if (customerDomain) {
    Sentry.setTag('isCustomerDomain', 'yes');
    Sentry.setTag('customerDomain.organizationUrl', customerDomain.organizationUrl);
    Sentry.setTag('customerDomain.sentryUrl', customerDomain.sentryUrl);
    Sentry.setTag('customerDomain.subdomain', customerDomain.subdomain);
    Sentry.setAttributes({
      isCustomerDomain: 'yes',
      'customerDomain.organizationUrl': customerDomain.organizationUrl,
      'customerDomain.sentryUrl': customerDomain.sentryUrl,
      'customerDomain.subdomain': customerDomain.subdomain,
    });
  }

  if (sentryClient) {
    addUIElementTagToSegmentSpan(sentryClient);
  }
}

export function isFilteredRequestErrorEvent(event: Event): boolean {
  const exceptionValues = event.exception?.values;

  if (!exceptionValues) {
    return false;
  }

  // In case there's a chain, we take the last entry, because that's the one
  // passed to `captureException`, and the one right before that, since
  // `RequestError`s are used as the main error's `cause` value in
  // `handleXhrErrorResponse`
  const mainAndMaybeCauseErrors = exceptionValues.slice(-2);

  for (const error of mainAndMaybeCauseErrors) {
    const {type = '', value = ''} = error;

    const allowedStatuses = FILTERED_STATUSES_BY_ERROR_TYPE[type];
    if (allowedStatuses) {
      const match = FILTERED_REQUEST_ERROR_VALUE_REGEX.exec(value);
      if (match && allowedStatuses.has(match[2]!)) {
        return true;
      }
    }
  }

  return false;
}

export function isEventWithFileUrl(event: Event): boolean {
  return !!event.request?.url?.startsWith('file://');
}

/**
 * Ignore unhandled rejections of `[null, null]`. The SDK keeps the original
 * array in the hint until after `beforeSend`, then normalizes it to the
 * `[null,null]` message shown in the stored event.
 */
function isNullTupleUnhandledRejectionEvent(hint: Sentry.EventHint): boolean {
  const originalException = hint.originalException;

  return (
    Array.isArray(originalException) &&
    originalException.length === 2 &&
    originalException.every(value => value === null)
  );
}

/** Tag and set fingerprint for UndefinedResponseBodyError events */
function handlePossibleUndefinedResponseBodyErrors(event: Event): void {
  // One or both of these may be undefined, depending on the type of event
  const [mainError, causeError] = event.exception?.values?.slice(-2).reverse() || [];

  const mainErrorIsURBE = mainError?.type === 'UndefinedResponseBodyError';
  const causeErrorIsURBE = causeError?.type === 'UndefinedResponseBodyError';

  if (mainErrorIsURBE || causeErrorIsURBE) {
    mainError!.type = 'UndefinedResponseBodyError';
    event.tags = {...event.tags, undefinedResponseBody: true};
    event.fingerprint = mainErrorIsURBE
      ? ['UndefinedResponseBodyError as main error']
      : ['UndefinedResponseBodyError as cause error'];
  }
}

export function addEndpointTagToRequestError(event: Event): void {
  const errorMessage = event.exception?.values?.[0]!.value || '';

  // The capturing group here turns `GET /dogs/are/great 500` into just `GET /dogs/are/great`
  const messageMatch = ENDPOINT_TAG_REGEX.exec(errorMessage);

  if (messageMatch) {
    event.tags = {...event.tags, endpoint: messageMatch[1]};
  }
}

function isFilteredLog(log: Log): boolean {
  // Ignore the console banner
  if (isConsoleBannerMessage(log.message)) {
    return true;
  }

  return false;
}
