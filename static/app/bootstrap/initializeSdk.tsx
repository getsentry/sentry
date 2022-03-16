import {browserHistory, createRoutes, match} from 'react-router';
import {ExtraErrorData} from '@sentry/integrations';
import * as Sentry from '@sentry/react';
import SentryRRWeb from '@sentry/rrweb';
import {Integrations} from '@sentry/tracing';
import {_browserPerformanceTimeOriginMode} from '@sentry/utils';

import {DISABLE_RR_WEB, SENTRY_RELEASE_VERSION, SPA_DSN} from 'sentry/constants';
import {Config} from 'sentry/types';
import {init as initApiSentryClient} from 'sentry/utils/apiSentryClient';

/**
 * We accept a routes argument here because importing `static/routes`
 * is expensive in regards to bundle size. Some entrypoints may opt to forgo
 * having routing instrumentation in order to have a smaller bundle size.
 * (e.g.  `static/views/integrationPipeline`)
 */
function getSentryIntegrations(hasReplays: boolean = false, routes?: Function) {
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
    }),
  ];
  if (hasReplays) {
    // eslint-disable-next-line no-console
    console.log('[sentry] Instrumenting session with rrweb');

    // TODO(ts): The type returned by SentryRRWeb seems to be somewhat
    // incompatible. It's a newer plugin, so this can be expected, but we
    // should fix.
    integrations.push(
      new SentryRRWeb({
        checkoutEveryNms: 60 * 1000, // 60 seconds
      }) as any
    );
  }
  return integrations;
}

/**
 * Initialize the Sentry SDK
 *
 * If `routes` is passed, we will instrument react-router. Not all
 * entrypoints require this.
 */
export function initializeSdk(config: Config, {routes}: {routes?: Function} = {}) {
  if (config.dsn_requests) {
    initApiSentryClient(config.dsn_requests);
  }

  const {apmSampling, sentryConfig, userIdentity} = config;
  const tracesSampleRate = apmSampling ?? 0;

  const hasReplays = userIdentity?.isStaff && !DISABLE_RR_WEB;

  Sentry.init({
    ...sentryConfig,
    /**
     * For SPA mode, we need a way to overwrite the default DSN from backend
     * as well as `whitelistUrls`
     */
    dsn: SPA_DSN || sentryConfig?.dsn,
    /**
     * Frontend can be built with a `SENTRY_RELEASE_VERSION` environment variable for release string, useful if frontend is
     * deployed separately from backend.
     */
    release: SENTRY_RELEASE_VERSION ?? sentryConfig?.release,
    whitelistUrls: SPA_DSN
      ? ['localhost', 'dev.getsentry.net', 'sentry.dev', 'webpack-internal://']
      : sentryConfig?.whitelistUrls,
    integrations: getSentryIntegrations(hasReplays, routes),
    tracesSampleRate,
    /**
     * There is a bug in Safari, that causes `AbortError` when fetch is aborted, and you are in the middle of reading the response.
     * In Chrome and other browsers, it is handled gracefully, where in Safari, it produces additional error, that is jumping
     * outside of the original Promise chain and bubbles up to the `unhandledRejection` handler, that we then captures as error.
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
  Sentry.setTag('rrweb.active', hasReplays ? 'yes' : 'no');
}
