import {browserHistory, createRoutes, match} from 'react-router';
import {ExtraErrorData} from '@sentry/integrations';
import {
  addGlobalEventProcessor,
  Breadcrumb,
  captureException,
  // BreadcrumbHint,
  Event as SentryEvent,
  EventHint,
  // Hub,
  getCurrentHub,
  init,
  reactRouterV3Instrumentation,
  setTag,
  setUser,
} from '@sentry/react';
import {Integrations} from '@sentry/tracing';
import {_browserPerformanceTimeOriginMode, uuid4} from '@sentry/utils';

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
            routingInstrumentation: reactRouterV3Instrumentation(
              browserHistory as any,
              createRoutes(routes()),
              match
            ),
          }
        : {}),
      idleTimeout: 5000,
      beforeNavigate(context) {
        setTimeout(() => {
          generateError(context.name);
        }, 1000);
        return {
          ...context,
        };
      },
      _metricOptions: {
        _reportAllChanges: false,
      },
      ...partialTracingOptions,
    }),
  ];

  return integrations;
}

let infiniteBreadcrumbs: Breadcrumb[] = [];

function setSession(sessionId: string): string {
  const hasSessionStorage = 'sessionStorage' in window;
  if (hasSessionStorage) {
    try {
      window.sessionStorage.setItem('sentry.infinite.breadcrumbs', sessionId);
    } catch {
      // this shouldn't happen
    }
  }

  return sessionId;
}

function getSession(): string | null {
  const hasSessionStorage = 'sessionStorage' in window;
  if (!hasSessionStorage) {
    return null;
  }

  try {
    return window.sessionStorage.getItem('sentry.infinite.breadcrumbs');
  } catch {
    // this shouldn't happen
  }

  return null;
}

function setDid(sessionId: string): string {
  const hasSessionStorage = 'sessionStorage' in window;
  if (hasSessionStorage) {
    try {
      window.localStorage.setItem('sentry.infinite.breadcrumb.did', sessionId);
    } catch {
      // this shouldn't happen
    }
  }

  return sessionId;
}

function getDid(): string | null {
  const hasSessionStorage = 'sessionStorage' in window;
  if (!hasSessionStorage) {
    return null;
  }

  try {
    return window.localStorage.getItem('sentry.infinite.breadcrumb.did');
  } catch {
    // this shouldn't happen
  }

  return null;
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

  init({
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

  const hub = getCurrentHub();

  function flushBreadcrumbs(sid: string, did: string) {
    const client = hub.getClient();
    if (client && infiniteBreadcrumbs.length) {
      client.sendEvent({
        message: 'Breadcrumb Event',
        event_id: uuid4(),
        tags: {sid, did},
        breadcrumbs: infiniteBreadcrumbs,
      });
    }
    infiniteBreadcrumbs = [];
  }

  const maybeDid = getDid();
  const did = maybeDid || setDid(uuid4());
  const sid =
    maybeDid === null ? setSession(uuid4()) : getSession() ?? setSession(uuid4());

  const scope = hub.getScope();
  if (scope) {
    scope.addScopeListener(updatedScope => {
      // @ts-ignore accessing private _breadcrumbs
      const len = updatedScope._breadcrumbs.length - 1;
      if (len === 0) {
        return;
      }

      // @ts-ignore accessing private _breadcrumbs
      infiniteBreadcrumbs.push(updatedScope._breadcrumbs[len]);

      if (infiniteBreadcrumbs.length >= 100) {
        flushBreadcrumbs(sid, did);
      }
    });
  }

  setInterval(() => {
    flushBreadcrumbs(sid, did);
  }, 5000);

  // Track timeOrigin Selection by the SDK to see if it improves transaction durations
  addGlobalEventProcessor((event: SentryEvent, _hint?: EventHint) => {
    event.tags = event.tags || {};
    event.tags['timeOrigin.mode'] = _browserPerformanceTimeOriginMode;
    event.tags.sid = sid;
    event.tags.did = did;
    return event;
  });

  if (userIdentity) {
    setUser(userIdentity);
  }
  if (window.__SENTRY__VERSION) {
    setTag('sentry_version', window.__SENTRY__VERSION);
  }

  LongTaskObserver.startPerformanceObserver();
  initializeMeasureAssetsTimeout();
}

function generateError(name: string | undefined) {
  // 10% sample to start
  const sampled = Math.random() < 0.1;
  if (sampled) {
    captureException(new Error(`${name} threw Error`));
  }
}
