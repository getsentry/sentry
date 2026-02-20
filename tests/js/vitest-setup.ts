/* eslint-disable import/no-nodejs-modules */
/// <reference types="vitest/globals" />

import '@testing-library/jest-dom/vitest';

import {webcrypto} from 'node:crypto';
import {
  // @ts-expect-error structuredClone is available in Node 17+ but types don't like it
  structuredClone as nodeStructuredClone,
  TextDecoder,
  TextEncoder,
} from 'node:util';

import {type ReactElement} from 'react';
import {cleanup, configure as configureRtl} from '@testing-library/react'; // eslint-disable-line no-restricted-imports

// eslint-disable-line no-restricted-imports

/**
 * Setup fetch mock via jest-fetch-mock (same as Jest setup).
 * This is needed for tests that import from 'jest-fetch-mock' and use
 * its APIs like fetchMock.mockResponse().
 */
import fetchMock, {enableFetchMocks} from 'jest-fetch-mock';
import {ConfigFixture} from 'sentry-fixture/config';

import {resetMockDate} from 'sentry-test/utils';

// eslint-disable-next-line jest/no-mocks-import
import type {Client} from 'sentry/__mocks__/api';
import {closeModal} from 'sentry/actionCreators/modal';
import PageFiltersStore from 'sentry/components/pageFilters/store';
// eslint-disable-next-line no-restricted-imports
import {DEFAULT_LOCALE_DATA, setLocale} from 'sentry/locale';
import AlertStore from 'sentry/stores/alertStore';
import ConfigStore from 'sentry/stores/configStore';
import DebugMetaStore from 'sentry/stores/debugMetaStore';
import GroupStore from 'sentry/stores/groupStore';
import GuideStore from 'sentry/stores/guideStore';
import HookStore from 'sentry/stores/hookStore';
import IndicatorStore from 'sentry/stores/indicatorStore';
import IssueListCacheStore from 'sentry/stores/IssueListCacheStore';
import MemberListStore from 'sentry/stores/memberListStore';
import OrganizationsStore from 'sentry/stores/organizationsStore';
import OrganizationStore from 'sentry/stores/organizationStore';
import ProjectsStatsStore from 'sentry/stores/projectsStatsStore';
import ProjectsStore from 'sentry/stores/projectsStore';
import TagStore from 'sentry/stores/tagStore';
import TeamStore from 'sentry/stores/teamStore';
import {DANGEROUS_SET_TEST_HISTORY} from 'sentry/utils/browserHistory';
import * as performanceForSentry from 'sentry/utils/performanceForSentry';

/**
 * Set locale to English
 */
setLocale(DEFAULT_LOCALE_DATA);

enableFetchMocks();

// @ts-expect-error XXX(epurkhiser): Gross hack to fix a bug in jsdom which makes testing of
// framer-motion SVG components fail
// See https://github.com/jsdom/jsdom/issues/1330
SVGElement.prototype.getTotalLength ??= () => 1;

/**
 * React Testing Library configuration to override the default test id attribute
 *
 * See: https://testing-library.com/docs/queries/bytestid/#overriding-data-testid
 */
configureRtl({testIdAttribute: 'data-test-id'});
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

/**
 * Mock (current) date to always be National Pasta Day
 * 2017-10-17T02:41:20.000Z
 */
resetMockDate();

// Some modules read config at import time (before test hooks run).
ConfigStore.loadInitialData(ConfigFixture());

/**
 * Global testing configuration
 */

/**
 * Mocks
 */
vi.mock('lodash/debounce', () => ({
  default: vi.fn((fn: any) => {
    fn.cancel = vi.fn();
    return fn;
  }),
}));
vi.mock('sentry/utils/recreateRoute');
vi.mock('sentry/api', async () => {
  return await import('sentry/__mocks__/api.vitest');
});
vi.mock('scroll-to-element', () => ({default: vi.fn()}));

vi.mock('@stripe/stripe-js', () => ({
  loadStripe: vi.fn(() =>
    Promise.resolve({
      createToken: vi.fn(() => Promise.resolve({token: {id: 'test-token'}})),
      confirmCardPayment: vi.fn(() =>
        Promise.resolve({error: undefined, paymentIntent: {id: 'test-payment'}})
      ),
      confirmCardSetup: vi.fn((secretKey: string) => {
        if (secretKey === 'ERROR') {
          return Promise.resolve({error: {message: 'card invalid'}});
        }
        return Promise.resolve({
          error: undefined,
          setupIntent: {payment_method: 'test-pm'},
        });
      }),
      handleCardAction: vi.fn(() =>
        Promise.resolve({setupIntent: {payment_method: 'test-pm'}})
      ),
      elements: vi.fn(() => ({
        create: vi.fn(() => ({
          mount: vi.fn(),
          on: vi.fn(),
          update: vi.fn(),
        })),
      })),
    })
  ),
}));
vi.mock('@stripe/react-stripe-js', async () => {
  const {useEffect} = await vi.importActual<typeof import('react')>('react');
  return {
    Elements: vi.fn(({children}: {children: any}) => children),
    AddressElement: vi.fn(({onReady}: any) => {
      useEffect(() => {
        if (onReady) {
          setTimeout(() => onReady(), 0);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
      }, []);
      return null;
    }),
    CardElement: vi.fn(() => null),
    PaymentElement: vi.fn(({onChange, onReady}: any) => {
      useEffect(() => {
        setTimeout(() => {
          if (onReady) {
            onReady();
          }
          if (onChange) {
            onChange({complete: true});
          }
        }, 0);
        // eslint-disable-next-line react-hooks/exhaustive-deps
      }, []);
      return null;
    }),
    useStripe: vi.fn(() => ({
      confirmCardPayment: vi.fn(() =>
        Promise.resolve({error: undefined, paymentIntent: {id: 'test-payment'}})
      ),
      confirmCardSetup: vi.fn((secretKey: string) => {
        if (secretKey === 'ERROR') {
          return Promise.resolve({error: {message: 'card invalid'}});
        }
        return Promise.resolve({
          error: undefined,
          setupIntent: {payment_method: 'test-pm'},
        });
      }),
      confirmSetup: vi.fn((options: any) => {
        if (options?.clientSecret === 'ERROR') {
          return Promise.resolve({error: {message: 'card invalid'}});
        }
        return Promise.resolve({
          error: undefined,
          setupIntent: {payment_method: 'test-pm'},
        });
      }),
      confirmPayment: vi.fn((options: any) => {
        if (options?.clientSecret === 'ERROR') {
          return Promise.resolve({error: {message: 'payment failed'}});
        }
        return Promise.resolve({
          error: undefined,
          paymentIntent: {id: 'test-payment'},
        });
      }),
    })),
    useElements: vi.fn(() => ({
      getElement: vi.fn(() => ({})),
      submit: vi.fn(() => Promise.resolve({error: undefined})),
    })),
  };
});
vi.mock('@amplitude/analytics-browser', async () => {
  const identifyInstance: any = {
    set: vi.fn(() => identifyInstance),
  };
  return {
    Identify: vi.fn(() => identifyInstance),
    setUserId: vi.fn(),
    identify: vi.fn(),
    init: vi.fn(),
    track: vi.fn(),
    setGroup: vi.fn(),
    Types: (await vi.importActual<any>('@amplitude/analytics-browser')).Types,
    _identifyInstance: identifyInstance,
  };
});
vi.mock('getsentry/utils/trackMarketingEvent');
vi.mock('getsentry/utils/trackAmplitudeEvent');
vi.mock('getsentry/utils/trackReloadEvent');
vi.mock('getsentry/utils/trackMetric');

vi.mock('sentry/utils/testableWindowLocation', () => ({
  testableWindowLocation: {
    assign: vi.fn(),
    replace: vi.fn(),
    reload: vi.fn(),
  },
}));

DANGEROUS_SET_TEST_HISTORY({
  goBack: vi.fn(),
  push: vi.fn(),
  replace: vi.fn(),
  listen: vi.fn(() => {}),
  listenBefore: vi.fn(),
  getCurrentLocation: vi.fn(() => ({pathname: '', query: {}})),
});

const DEBUG_FOCUS_PATCHING = process.env.VITEST_DEBUG_FOCUS === '1';
const NATIVE_DATE = globalThis.Date;
const NATIVE_ABORT_CONTROLLER = globalThis.AbortController;
const NATIVE_ABORT_SIGNAL = globalThis.AbortSignal;
const UTC_RESOLVED_OPTIONS = {
  locale: 'en-US',
  calendar: 'gregory',
  numberingSystem: 'latn',
  timeZone: 'UTC',
  timeZoneName: 'short',
} as const;

function ensureNativeDateGlobal() {
  if (typeof globalThis.Date === 'function') {
    return;
  }

  Object.defineProperty(globalThis, 'Date', {
    configurable: true,
    writable: true,
    value: NATIVE_DATE,
  });
}

function ensureNativeAbortGlobals() {
  if (NATIVE_ABORT_CONTROLLER && globalThis.AbortController !== NATIVE_ABORT_CONTROLLER) {
    Object.defineProperty(globalThis, 'AbortController', {
      configurable: true,
      writable: true,
      value: NATIVE_ABORT_CONTROLLER,
    });
  }

  if (NATIVE_ABORT_SIGNAL && globalThis.AbortSignal !== NATIVE_ABORT_SIGNAL) {
    Object.defineProperty(globalThis, 'AbortSignal', {
      configurable: true,
      writable: true,
      value: NATIVE_ABORT_SIGNAL,
    });
  }
}

function applyGlobalBaselineMocks() {
  // Tests may call vi.restoreAllMocks(); re-apply setup-level spies each test.
  if (!vi.isMockFunction(performanceForSentry.VisuallyCompleteWithData)) {
    vi.spyOn(performanceForSentry, 'VisuallyCompleteWithData').mockImplementation(
      props => props.children as ReactElement
    );
  }

  if (!vi.isMockFunction(Intl.DateTimeFormat.prototype.resolvedOptions)) {
    vi.spyOn(Intl.DateTimeFormat.prototype, 'resolvedOptions').mockImplementation(
      () => UTC_RESOLVED_OPTIONS
    );
  }
}

function resetNavigationState() {
  // Location/query/hash can leak across files when isolate:false reuses workers.
  try {
    const jsdomGlobal = (globalThis as any).jsdom;
    if (jsdomGlobal?.reconfigure) {
      jsdomGlobal.reconfigure({url: 'http://localhost/'});
      return;
    }
    window.history.replaceState({}, '', '/');
  } catch {
    // noop
  }
}

function normalizeNavigatorClipboard() {
  const clipboard = window.navigator.clipboard;
  if (!clipboard) {
    return;
  }

  // Some suites replace the descriptor with getter-only behavior, which then
  // breaks later tests that assign navigator.clipboard directly.
  try {
    Object.defineProperty(window.navigator, 'clipboard', {
      configurable: true,
      enumerable: true,
      writable: true,
      value: clipboard,
    });
  } catch {
    // noop
  }
}

function resetDocumentInteractionState() {
  closeModal();
  document.body.style.removeProperty('pointer-events');
  document.body.style.removeProperty('overflow');
  document.body.style.removeProperty('overscroll-behavior');
  document.documentElement.style.removeProperty('pointer-events');
}

function normalizeHTMLElementFocus() {
  const focusDescriptor = Object.getOwnPropertyDescriptor(
    window.HTMLElement.prototype,
    'focus'
  );

  if (!focusDescriptor) {
    return;
  }

  if ('value' in focusDescriptor && focusDescriptor.writable) {
    return;
  }

  const focusImpl = window.HTMLElement.prototype.focus;

  try {
    Object.defineProperty(window.HTMLElement.prototype, 'focus', {
      configurable: true,
      enumerable: focusDescriptor.enumerable ?? false,
      writable: true,
      value: focusImpl,
    });
  } catch {
    if (DEBUG_FOCUS_PATCHING) {
      const {currentTestName, testPath} = expect.getState();
      process.stderr.write(
        `[vitest focus patch] failed to normalize focus descriptor` +
          ` (testPath=${testPath ?? 'unknown'}, test=${currentTestName ?? 'unknown'})\n`
      );
    }
    return;
  }

  if (DEBUG_FOCUS_PATCHING) {
    const {currentTestName, testPath} = expect.getState();
    process.stderr.write(
      `[vitest focus patch] normalized non-writable HTMLElement.prototype.focus` +
        ` (testPath=${testPath ?? 'unknown'}, test=${currentTestName ?? 'unknown'})\n`
    );
  }
}

// Some suites leave HTMLElement.prototype.focus as accessor-only in isolate:false
// mode. @react-aria/interactions patches this method at module init and crashes
// if it isn't writable.
normalizeHTMLElementFocus();
normalizeNavigatorClipboard();
ensureNativeDateGlobal();
ensureNativeAbortGlobals();
applyGlobalBaselineMocks();

// Close any open modals before each test
beforeEach(closeModal);

// With isolate:false, @testing-library/react only loads once (for the first file
// that imports it). RTL's auto-cleanup (afterEach(cleanup)) is therefore only
// registered for that first file's suite scope. Registering it here in the
// global setup ensures cleanup runs after every test in every file.
afterEach(() => {
  resetDocumentInteractionState();
  cleanup();
});
afterEach(normalizeHTMLElementFocus);
afterEach(normalizeNavigatorClipboard);

vi.mock('react-virtualized', async () => {
  const ActualReactVirtualized =
    await vi.importActual<typeof import('react-virtualized')>('react-virtualized');
  return {
    ...ActualReactVirtualized,
    AutoSizer: ({
      children,
    }: {
      children: (props: {height: number; width: number}) => React.ReactNode;
    }) => children({width: 100, height: 100}),
  };
});

vi.mock('echarts-for-react/lib/core', async () => {
  const ReactActual = await vi.importActual<typeof import('react')>('react');
  return {
    default: class extends ReactActual.Component {
      render() {
        return null;
      }
    },
  };
});

vi.mock('@sentry/react', async () => {
  const SentryReact =
    await vi.importActual<typeof import('@sentry/react')>('@sentry/react');
  return {
    ...SentryReact,
    init: vi.fn(),
    setTag: vi.fn(),
    setTags: vi.fn(),
    setExtra: vi.fn(),
    setExtras: vi.fn(),
    captureBreadcrumb: vi.fn(),
    addBreadcrumb: vi.fn(),
    captureMessage: vi.fn(),
    captureException: vi.fn(),
    showReportDialog: vi.fn(),
    getDefaultIntegrations: vi.fn(SentryReact.getDefaultIntegrations),
    startSpan: vi.fn(SentryReact.startSpan),
    finishSpan: vi.fn(),
    lastEventId: vi.fn(),
    getClient: vi.fn(SentryReact.getClient),
    getCurrentScope: vi.fn(SentryReact.getCurrentScope),
    withScope: vi.fn(SentryReact.withScope),
    withProfiler: SentryReact.withProfiler,
    metrics: {
      increment: vi.fn(),
      gauge: vi.fn(),
      set: vi.fn(),
      distribution: vi.fn(),
    },
    reactRouterV6BrowserTracingIntegration: vi.fn().mockReturnValue({}),
    browserTracingIntegration: vi.fn().mockReturnValue({}),
    browserProfilingIntegration: vi.fn().mockReturnValue({}),
    addEventProcessor: vi.fn(),
    // eslint-disable-next-line prefer-arrow-callback
    BrowserClient: vi.fn(function () {
      return {captureEvent: vi.fn()};
    }),
    startInactiveSpan: () => ({
      end: vi.fn(),
      setStatus: vi.fn(),
      startChild: vi.fn().mockReturnValue({
        end: vi.fn(),
      }),
    }),
    logger: {
      warn: vi.fn(),
      error: vi.fn(),
      fatal: vi.fn(),
      info: vi.fn(),
      debug: vi.fn(),
      trace: vi.fn(),
      fmt: vi.fn(),
    },
  };
});

beforeEach(() => {
  // Reset all Reflux stores to their initial state before each test.
  // Required because isolate:false shares the module registry across files
  // in a worker, so module-level singletons persist between files.

  ensureNativeDateGlobal();
  ensureNativeAbortGlobals();
  applyGlobalBaselineMocks();
  normalizeHTMLElementFocus();
  resetNavigationState();
  resetMockDate();
  normalizeNavigatorClipboard();
  resetDocumentInteractionState();
  fetchMock.resetMocks();

  window.MockApiClient.clearMockResponses();
  window.MockApiClient.asyncDelay = undefined;
  window.MockApiClient.errors = {};

  window.localStorage.clear();
  window.sessionStorage.clear();

  AlertStore.init();
  ConfigStore.loadInitialData(ConfigFixture());
  DebugMetaStore.reset();
  GroupStore.reset();
  GuideStore.init();
  HookStore.init();
  IndicatorStore.init();
  IssueListCacheStore.reset();
  MemberListStore.reset();
  OrganizationStore.reset();
  OrganizationsStore.init();
  PageFiltersStore.reset();
  ProjectsStore.reset();
  ProjectsStatsStore.reset();
  TagStore.reset();
  TeamStore.reset();
});

afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
  resetDocumentInteractionState();
  ensureNativeDateGlobal();
  ensureNativeAbortGlobals();
});

afterAll(() => {
  closeModal();
});

/**
 * Test Globals
 */
declare global {
  /**
   * Generates a promise that resolves on the next macro-task
   */
  var tick: () => Promise<void>;
  /**
   * Used to mock API requests
   */
  var MockApiClient: typeof Client;
}

// needed by cbor-web for webauthn
window.TextEncoder = TextEncoder as typeof window.TextEncoder;
window.TextDecoder = TextDecoder as typeof window.TextDecoder;

// This is so we can use async/await in tests instead of wrapping with `setTimeout`.
window.tick = () => new Promise(resolve => setTimeout(resolve));

// Import the mocked Client to attach to window.
const {Client: MockClient} = await import('sentry/__mocks__/api.vitest');
window.MockApiClient = MockClient as unknown as typeof Client;

window.scrollTo = vi.fn() as any;

window.ra = {event: vi.fn()};

// The JSDOM implementation is too slow
// Especially for dropdowns that try to position themselves
// perf issue - https://github.com/jsdom/jsdom/issues/3234
Object.defineProperty(window, 'getComputedStyle', {
  value: (el: HTMLElement) => {
    /**
     * This is based on the jsdom implementation of getComputedStyle
     * https://github.com/jsdom/jsdom/blob/9dae17bf0ad09042cfccd82e6a9d06d3a615d9f4/lib/jsdom/browser/Window.js#L779-L820
     *
     * It is missing global style parsing and will only return styles applied directly to an element.
     * Will not return styles that are global or from emotion
     */
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
    addListener: vi.fn(), // Deprecated
    removeListener: vi.fn(), // Deprecated
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }),
});

window.IntersectionObserver = class IntersectionObserver {
  root = null;
  rootMargin = '';
  thresholds = [];
  takeRecords = vi.fn();

  observe() {}
  unobserve() {}
  disconnect() {}
};

window.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

// Mock the crypto.subtle API for Gravatar
Object.defineProperty(global.self, 'crypto', {
  value: {
    subtle: webcrypto.subtle,
  },
});

if (typeof globalThis.structuredClone === 'undefined') {
  globalThis.structuredClone = nodeStructuredClone;
}
