import {browserHistory, createRoutes, match} from 'react-router';
import {ExtraErrorData} from '@sentry/integrations';
import * as Sentry from '@sentry/react';
import {Integrations} from '@sentry/tracing';
import {_browserPerformanceTimeOriginMode} from '@sentry/utils';

import {SENTRY_RELEASE_VERSION, SPA_DSN} from 'sentry/constants';
import {Config} from 'sentry/types';
import {
  initializeMeasureAssetsTimeout,
  LongTaskObserver,
} from 'sentry/utils/performanceForSentry';

const SPA_MODE_ALLOW_URLS = [
  'localhost',
  'dev.getsentry.net',
  'sentry.dev',
  'webpack-internal://',
];

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
  const partialTracingOptions: Partial<Integrations.BrowserTracing['options']> = {
    tracingOrigins: ['localhost', /^\//, ...extraTracingOrigins],
  };

  const integrations = [
    new ExtraErrorData({
      // 6 is arbitrary, seems like a nice number
      depth: 6,
    }),
    new Integrations.BrowserTracing({
      ...(typeof routes === 'function'
        ? {
            routingInstrumentation: Sentry.reactRouterV3Instrumentation(
              browserHistory as any,
              createRoutes(routes()),
              match
            ),
          }
        : {}),
      idleTimeout: 5000,
      _metricOptions: {
        _reportAllChanges: false,
      },
      ...partialTracingOptions,
    }),
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
    integrations: getSentryIntegrations(sentryConfig, routes),
    tracesSampleRate,
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
    ignoreErrors: ['AbortError: Fetch is aborted'],
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

  LongTaskObserver.startPerformanceObserver();
  initializeMeasureAssetsTimeout();
}
