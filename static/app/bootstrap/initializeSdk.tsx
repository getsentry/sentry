// eslint-disable-next-line simple-import-sort/imports
import {browserHistory, createRoutes, match} from 'react-router';
import {ExtraErrorData} from '@sentry/integrations';
import * as Sentry from '@sentry/react';
import {BrowserTracing} from '@sentry/tracing';
import {_browserPerformanceTimeOriginMode} from '@sentry/utils';

import {SENTRY_RELEASE_VERSION, SPA_DSN} from 'sentry/constants';
import {Config} from 'sentry/types';
import {addExtraMeasurements} from 'sentry/utils/performanceForSentry';
import {normalizeUrl} from 'sentry/utils/withDomainRequired';

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
    ],
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
