/**
 * Setup file for page-level snapshot tests.
 *
 * Like setup.ts but does NOT mock sentry/api or enable fetch mocks.
 * MSW intercepts real fetch calls from the real API Client.
 */
'use strict';

import '@testing-library/jest-dom';

// Fetch API globals restored by jest-environment-page-snapshots.js.
import {webcrypto} from 'node:crypto'; // eslint-disable-line import/no-nodejs-modules
import {TextDecoder, TextEncoder} from 'node:util'; // eslint-disable-line import/no-nodejs-modules

import {type ReactElement} from 'react';
import {configure as configureRtl} from '@testing-library/react'; // eslint-disable-line no-restricted-imports
import {MotionGlobalConfig} from 'framer-motion';
import {ConfigFixture} from 'sentry-fixture/config';

import {MockResizeObserver, resetResizeObservers} from 'sentry-test/resizeObserver';
import {resetMockDate} from 'sentry-test/utils';

// eslint-disable-next-line no-restricted-imports
import {DEFAULT_LOCALE_DATA, setLocale} from 'sentry/locale';
import {ConfigStore} from 'sentry/stores/configStore';
import * as performanceForSentry from 'sentry/utils/performanceForSentry';

// Lazy import to avoid pulling in the full component tree at setup time.
// closePageBrowser is only needed in afterAll.
let _closePageBrowser: (() => Promise<void>) | null = null;

setLocale(DEFAULT_LOCALE_DATA);

// NOTE: No enableFetchMocks() — MSW handles network interception.
// NOTE: No jest.mock('sentry/api') — the real Client runs, MSW intercepts fetch.

// @ts-expect-error jsdom SVG workaround for framer-motion
SVGElement.prototype.getTotalLength ??= () => 1;

MotionGlobalConfig.skipAnimations = true;

configureRtl({testIdAttribute: 'data-test-id'});

resetMockDate();

jest.mock('lodash/debounce', () =>
  jest.fn(fn => {
    fn.cancel = jest.fn();
    return fn;
  })
);
jest.mock('@tanstack/react-pacer', () => ({
  ...jest.requireActual('@tanstack/react-pacer'),
  useAsyncDebouncedCallback: <TFn>(fn: TFn) => fn,
  useDebouncedCallback: <TFn>(fn: TFn) => fn,
  useDebouncedValue: <T>(value: T) => [value] as const,
}));
jest.mock('sentry/utils/recreateRoute');
jest
  .spyOn(performanceForSentry, 'VisuallyCompleteWithData')
  .mockImplementation(props => props.children as ReactElement);

jest.mock('@sentry-internal/global-search', () => ({
  SentryGlobalSearch: jest.fn().mockImplementation(() => ({
    query: jest.fn().mockResolvedValue([]),
  })),
}));

jest.mock('@stripe/stripe-js', () => ({
  loadStripe: jest.fn(() => Promise.resolve(null)),
}));
jest.mock('@stripe/react-stripe-js', () => ({
  Elements: jest.fn(({children}: {children: any}) => children),
  useStripe: jest.fn(() => null),
  useElements: jest.fn(() => null),
}));
jest.mock('getsentry/utils/trackMarketingEvent');
jest.mock('getsentry/utils/trackAmplitudeEvent');
jest.mock('getsentry/utils/trackReloadEvent');
jest.mock('getsentry/utils/trackMetric');

jest.mock('sentry/utils/testableWindowLocation', () => ({
  testableWindowLocation: {
    assign: jest.fn(),
    replace: jest.fn(),
    reload: jest.fn(),
  },
}));

jest.mock('echarts-for-react/lib/core', function echartsMockFactory() {
  const ReactActual = require('react');
  return class extends ReactActual.Component {
    render() {
      return null;
    }
  };
});

jest.mock('@sentry/react', function sentryReact() {
  const SentryReact = jest.requireActual('@sentry/react');
  return {
    ...SentryReact,
    init: jest.fn(),
    setTag: jest.fn(),
    setTags: jest.fn(),
    getReplay: jest.fn(),
    setExtra: jest.fn(),
    setExtras: jest.fn(),
    captureBreadcrumb: jest.fn(),
    addBreadcrumb: jest.fn(),
    captureMessage: jest.fn(),
    captureException: jest.fn(),
    showReportDialog: jest.fn(),
    getDefaultIntegrations: jest.spyOn(SentryReact, 'getDefaultIntegrations'),
    startSpan: jest.spyOn(SentryReact, 'startSpan'),
    finishSpan: jest.fn(),
    lastEventId: jest.fn(),
    getClient: jest.spyOn(SentryReact, 'getClient'),
    getCurrentScope: jest.spyOn(SentryReact, 'getCurrentScope'),
    withScope: jest.spyOn(SentryReact, 'withScope'),
    withProfiler: SentryReact.withProfiler,
    metrics: {
      count: jest.fn(),
      increment: jest.fn(),
      gauge: jest.fn(),
      set: jest.fn(),
      distribution: jest.fn(),
    },
    reactRouterV6BrowserTracingIntegration: jest.fn().mockReturnValue({}),
    browserTracingIntegration: jest.fn().mockReturnValue({}),
    browserProfilingIntegration: jest.fn().mockReturnValue({}),
    addEventProcessor: jest.fn(),
    BrowserClient: jest.fn().mockReturnValue({captureEvent: jest.fn()}),
    startInactiveSpan: () => ({
      end: jest.fn(),
      setStatus: jest.fn(),
      startChild: jest.fn().mockReturnValue({end: jest.fn()}),
      spanContext: jest
        .fn()
        .mockReturnValue({spanId: 'test-span-id', traceId: 'test-trace-id'}),
    }),
    logger: {
      warn: jest.fn(),
      error: jest.fn(),
      fatal: jest.fn(),
      info: jest.fn(),
      debug: jest.fn(),
      trace: jest.fn(),
      fmt: jest.fn(),
    },
  };
});

ConfigStore.loadInitialData(ConfigFixture());

jest.spyOn(Intl.DateTimeFormat.prototype, 'resolvedOptions').mockImplementation(() => ({
  locale: 'en-US',
  calendar: 'gregory',
  numberingSystem: 'latn',
  timeZone: 'UTC',
  timeZoneName: 'short',
}));

window.TextEncoder = TextEncoder;
window.TextDecoder = TextDecoder as typeof window.TextDecoder;
window.tick = () => new Promise(resolve => setTimeout(resolve));
window.scrollTo = jest.fn();
window.ra = {event: jest.fn()};

Object.defineProperty(window, 'getComputedStyle', {
  value: (el: HTMLElement) => {
    const declaration = new CSSStyleDeclaration();
    const {style} = el;
    Array.prototype.forEach.call(style, (property: string) => {
      declaration.setProperty(
        property,
        style.getPropertyValue(property),
        style.getPropertyPriority(property)
      );
    });
    return declaration;
  },
  configurable: true,
  writable: true,
});

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  }),
});

window.IntersectionObserver = class IntersectionObserver {
  root = null;
  rootMargin = '';
  scrollMargin = '';
  thresholds = [];
  takeRecords = jest.fn();
  observe() {}
  unobserve() {}
  disconnect() {}
};

window.ResizeObserver = MockResizeObserver;

Object.defineProperty(global.self, 'crypto', {
  value: {subtle: webcrypto.subtle},
});

if (typeof globalThis.structuredClone !== 'function') {
  // eslint-disable-next-line import/no-nodejs-modules
  const nodeUtil = require('node:util') as {
    structuredClone?: typeof globalThis.structuredClone;
  };
  globalThis.structuredClone =
    nodeUtil.structuredClone ?? ((value: unknown) => JSON.parse(JSON.stringify(value)));
}

if (globalThis.setImmediate === undefined) {
  // @ts-expect-error setImmediate polyfill for jsdom
  globalThis.setImmediate = setTimeout;
  // @ts-expect-error setImmediate polyfill for jsdom
  globalThis.clearImmediate = clearTimeout;
}

beforeEach(() => {
  jest.clearAllMocks();
});
afterEach(resetResizeObservers);

afterAll(async () => {
  if (!_closePageBrowser) {
    const mod = await import('./snapshots/pageSnapshot');
    _closePageBrowser = mod.closePageBrowser;
  }
  await _closePageBrowser();
});

/**
 * Call AFTER server.listen() to wrap MSW's fetch interceptor with
 * relative URL resolution. Node's fetch requires absolute URLs but
 * Sentry's API client uses relative paths.
 */
export function wrapFetchForRelativeURLs() {
  const mswFetch = globalThis.fetch;
  (globalThis as any).fetch = function patchedFetch(
    input: RequestInfo | URL,
    init?: RequestInit
  ) {
    if (typeof input === 'string' && !input.startsWith('http')) {
      input = new URL(input, window.location.href || 'http://localhost').href;
    }
    return mswFetch(input, init);
  };
}

declare global {
  var tick: () => Promise<void>;
}
