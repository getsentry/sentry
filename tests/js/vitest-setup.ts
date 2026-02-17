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
import {configure as configureRtl} from '@testing-library/react'; // eslint-disable-line no-restricted-imports

/**
 * Setup fetch mock via jest-fetch-mock (same as Jest setup).
 * This is needed for tests that import from 'jest-fetch-mock' and use
 * its APIs like fetchMock.mockResponse().
 */
import {enableFetchMocks} from 'jest-fetch-mock';
import {ConfigFixture} from 'sentry-fixture/config';

import {resetMockDate} from 'sentry-test/utils';

// eslint-disable-next-line jest/no-mocks-import
import type {Client} from 'sentry/__mocks__/api';
import {closeModal} from 'sentry/actionCreators/modal';
// eslint-disable-next-line no-restricted-imports
import {DEFAULT_LOCALE_DATA, setLocale} from 'sentry/locale';
import ConfigStore from 'sentry/stores/configStore';
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

/**
 * Mock (current) date to always be National Pasta Day
 * 2017-10-17T02:41:20.000Z
 */
resetMockDate();

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
vi.spyOn(performanceForSentry, 'VisuallyCompleteWithData').mockImplementation(
  props => props.children as ReactElement
);
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

// Close any open modals before each test
beforeEach(closeModal);

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
    BrowserClient: vi.fn(() => {
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

ConfigStore.loadInitialData(ConfigFixture());

// Default browser timezone to UTC
vi.spyOn(Intl.DateTimeFormat.prototype, 'resolvedOptions').mockImplementation(() => ({
  locale: 'en-US',
  calendar: 'gregory',
  numberingSystem: 'latn',
  timeZone: 'UTC',
  timeZoneName: 'short',
}));

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
window.MockApiClient = MockClient;

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
