// eslint-disable-next-line simple-import-sort/imports
import {browserHistory, createRoutes, match} from 'react-router';
import {ExtraErrorData} from '@sentry/integrations';
import * as Sentry from '@sentry/react';
import {BrowserTracing} from '@sentry/react';
import {_browserPerformanceTimeOriginMode} from '@sentry/utils';
import {Event} from '@sentry/types';

import {SENTRY_RELEASE_VERSION, SPA_DSN} from 'sentry/constants';
import {Config} from 'sentry/types';
import {addExtraMeasurements, addUIElementTag} from 'sentry/utils/performanceForSentry';
import {normalizeUrl} from 'sentry/utils/withDomainRequired';
import {HTTPTimingIntegration} from 'sentry/utils/performanceForSentry/integrations';

const SPA_MODE_ALLOW_URLS = [
  'localhost',
  'dev.getsentry.net',
  'sentry.dev',
  'webpack-internal://',
];

// We check for `window.__initialData.user` property and only enable profiling
// for Sentry employees. This is to prevent a Violation error being visible in
// the browser console for our users.
const shouldEnableBrowserProfiling = window?.__initialData?.user?.isSuperuser;
/**
 * We accept a routes argument here because importing `static/routes`
 * is expensive in regards to bundle size. Some entrypoints may opt to forgo
 * having routing instrumentation in order to have a smaller bundle size.
 * (e.g.  `static/views/integrationPipeline`)
 */
function getSentryIntegrations(sentryConfig: Config['sentryConfig'], routes?: Function) {
  const extraTracingOrigins = SPA_DSN
    ? SPA_MODE_ALLOW_URLS
    : [...sentryConfig?.whitelistUrls];
  const partialTracingOptions: Partial<BrowserTracing['options']> = {
    tracingOrigins: ['localhost', /^\//, ...extraTracingOrigins],
  };

  const integrations = [
    new ExtraErrorData({
      // 6 is arbitrary, seems like a nice number
      depth: 6,
    }),
    new BrowserTracing({
      ...(typeof routes === 'function'
        ? {
            routingInstrumentation: Sentry.reactRouterV3Instrumentation(
              browserHistory as any,
              createRoutes(routes()),
              match
            ),
          }
        : {}),
      _experiments: {
        enableInteractions: true,
        onStartRouteTransaction: Sentry.onProfilingStartRouteTransaction,
      },
      ...partialTracingOptions,
    }),
    new Sentry.BrowserProfilingIntegration(),
    new HTTPTimingIntegration(),
  ];

  return integrations;
}

/**
 * Initialize the Sentry SDK
 *
 * If `routes` is passed, we will instrument react-router. Not all
 * entrypoints require this.
 */
export function initializeSdk(config: Config, {routes}: {routes?: Function} = {}) {
  const {apmSampling, sentryConfig, userIdentity} = config;
  const tracesSampleRate = apmSampling ?? 0;

  Sentry.init({
    ...sentryConfig,
    /**
     * For SPA mode, we need a way to overwrite the default DSN from backend
     * as well as `whitelistUrls`
     */
    dsn: SPA_DSN || sentryConfig?.dsn,
    /**
     * Frontend can be built with a `SENTRY_RELEASE_VERSION` environment
     * variable for release string, useful if frontend is deployed separately
     * from backend.
     */
    release: SENTRY_RELEASE_VERSION ?? sentryConfig?.release,
    allowUrls: SPA_DSN ? SPA_MODE_ALLOW_URLS : sentryConfig?.whitelistUrls,
    denyUrls: [/^file:\/\//],
    integrations: getSentryIntegrations(sentryConfig, routes),
    tracesSampleRate,
    // @ts-ignore not part of browser SDK types yet
    profilesSampleRate: shouldEnableBrowserProfiling ? 1 : 0,
    tracesSampler: context => {
      if (context.transactionContext.op?.startsWith('ui.action')) {
        return tracesSampleRate / 100;
      }
      return tracesSampleRate;
    },
    beforeSendTransaction(event) {
      addExtraMeasurements(event);
      addUIElementTag(event);

      event.spans = event.spans?.filter(span => {
        // Filter analytic timeout spans.
        return ['reload.getsentry.net', 'amplitude.com'].every(
          partialDesc => !span.description?.includes(partialDesc)
        );
      });
      if (event.transaction) {
        event.transaction = normalizeUrl(event.transaction, {forceCustomerDomain: true});
      }
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
      'AbortError: Fetch is aborted',
      /**
       * Thrown when firefox prevents an add-on from refrencing a DOM element
       * that has been removed.
       */
      "TypeError: can't access dead object",
      /**
       * React internal error thrown when something outside react modifies the DOM
       * This is usually because of a browser extension or chrome translate page
       */
      "NotFoundError: Failed to execute 'removeChild' on 'Node': The node to be removed is not a child of this node.",
      "NotFoundError: Failed to execute 'insertBefore' on 'Node': The node before which the new node is to be inserted is not a child of this node.",
    ],

    // Temporary fix while `ignoreErrors` bug is fixed and request error handling is cleaned up
    beforeSend(event, _hint) {
      return isFilteredRequestErrorEvent(event) ? null : event;
    },
  });

  // Track timeOrigin Selection by the SDK to see if it improves transaction durations
  Sentry.addGlobalEventProcessor((event: Sentry.Event, _hint?: Sentry.EventHint) => {
    event.tags = event.tags || {};
    event.tags['timeOrigin.mode'] = _browserPerformanceTimeOriginMode;
    return event;
  });

  if (userIdentity) {
    Sentry.setUser(userIdentity);
  }
  if (window.__SENTRY__VERSION) {
    Sentry.setTag('sentry_version', window.__SENTRY__VERSION);
  }

  const {customerDomain} = window.__initialData;

  if (customerDomain) {
    Sentry.setTag('isCustomerDomain', 'yes');
    Sentry.setTag('customerDomain.organizationUrl', customerDomain.organizationUrl);
    Sentry.setTag('customerDomain.sentryUrl', customerDomain.sentryUrl);
    Sentry.setTag('customerDomain.subdomain', customerDomain.subdomain);
  }
}

export function isFilteredRequestErrorEvent(event: Event): boolean {
  const exceptionValues = event.exception?.values;

  if (!exceptionValues) {
    return false;
  }

  // In case there's a chain, we take the last entry, because that's the one
  // passed to `captureException`
  const mainError = exceptionValues[exceptionValues.length - 1];

  const {type = '', value = ''} = mainError;

  const is200 =
    ['RequestError'].includes(type) && !!value.match('(GET|POST|PUT|DELETE) .* 200');
  const is401 =
    ['UnauthorizedError', 'RequestError'].includes(type) &&
    !!value.match('(GET|POST|PUT|DELETE) .* 401');
  const is403 =
    ['ForbiddenError', 'RequestError'].includes(type) &&
    !!value.match('(GET|POST|PUT|DELETE) .* 403');
  const is404 =
    ['NotFoundError', 'RequestError'].includes(type) &&
    !!value.match('(GET|POST|PUT|DELETE) .* 404');
  const is429 =
    ['TooManyRequestsError', 'RequestError'].includes(type) &&
    !!value.match('(GET|POST|PUT|DELETE) .* 429');

  return is200 || is401 || is403 || is404 || is429;
}
