import '@testing-library/jest-dom/vitest';

import type {ReactElement} from 'react';
import {configure as configureRtl} from '@testing-library/react'; // eslint-disable-line no-restricted-imports
import {webcrypto} from 'node:crypto';
import {TextDecoder, TextEncoder} from 'node:util';
import {ConfigFixture} from 'sentry-fixture/config';
import {vi} from 'vitest';
import createFetchMock from 'vitest-fetch-mock';

import {resetMockDate} from 'sentry-test/utils';

// eslint-disable-next-line no-restricted-imports
import {DEFAULT_LOCALE_DATA, setLocale} from 'sentry/locale';
import ConfigStore from 'sentry/stores/configStore';
import {DANGEROUS_SET_TEST_HISTORY} from 'sentry/utils/browserHistory';
import * as performanceForSentry from 'sentry/utils/performanceForSentry';

/**
 * Set locale to English
 */
setLocale(DEFAULT_LOCALE_DATA);

/**
 * Setup fetch mocks (needed to define the `Request` global)
 */
const fetchMock = createFetchMock(vi);
fetchMock.doMock();

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
  default: vi.fn(fn => {
    fn.cancel = vi.fn();
    return fn;
  }),
}));
vi.mock('sentry/utils/recreateRoute');
vi.mock('sentry/api');
vi.spyOn(performanceForSentry, 'VisuallyCompleteWithData').mockImplementation(
  props => props.children as ReactElement
);
vi.mock('scroll-to-element', () => ({
  default: vi.fn(),
}));

vi.mock('getsentry/utils/stripe');
vi.mock('getsentry/utils/trackMarketingEvent');
vi.mock('getsentry/utils/trackAmplitudeEvent');
vi.mock('getsentry/utils/trackReloadEvent');
vi.mock('getsentry/utils/trackMetric');

DANGEROUS_SET_TEST_HISTORY({
  goBack: vi.fn(),
  push: vi.fn(),
  replace: vi.fn(),
  listen: vi.fn(() => {}),
  listenBefore: vi.fn(),
  getCurrentLocation: vi.fn(() => ({pathname: '', query: {}})),
});

vi.mock('react-virtualized', async function reactVirtualizedMockFactory() {
  const ActualReactVirtualized = await vi.importActual('react-virtualized');
  return {
    ...ActualReactVirtualized,
    AutoSizer: ({
      children,
    }: {
      children: (props: {height: number; width: number}) => React.ReactNode;
    }) => children({width: 100, height: 100}),
  };
});

vi.mock('echarts-for-react/lib/core', async function echartsMockFactory() {
  // We need to do this because `vi.mock` gets hoisted by babel and `React` is not
  // guaranteed to be in scope
  const ReactActual = await vi.importActual<typeof import('react')>('react');

  // We need a class component here because `BaseChart` passes `ref` which will
  // error if we return a stateless/functional component
  return {
    default: class extends ReactActual.Component {
      render() {
        return null;
      }
    },
  };
});

vi.mock('@sentry/react', async function sentryReact() {
  const SentryReact = await vi.importActual('@sentry/react');
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
    // getDefaultIntegrations: vi.spyOn(SentryReact, 'getDefaultIntegrations'),
    // startSpan: vi.spyOn(SentryReact, 'startSpan'),
    finishSpan: vi.fn(),
    lastEventId: vi.fn(),
    // getClient: vi.spyOn(SentryReact, 'getClient'),
    // getCurrentScope: vi.spyOn(SentryReact, 'getCurrentScope'),
    // withScope: vi.spyOn(SentryReact, 'withScope'),
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
    BrowserClient: vi.fn().mockReturnValue({
      captureEvent: vi.fn(),
    }),
    startInactiveSpan: () => ({
      end: vi.fn(),
      setStatus: vi.fn(),
      startChild: vi.fn().mockReturnValue({
        end: vi.fn(),
      }),
    }),
  };
});

ConfigStore.loadInitialData(ConfigFixture());

/**
 * Test Globals
 */
declare global {
  /**
   * Generates a promise that resolves on the next macro-task
   */
  // eslint-disable-next-line no-var
  var tick: () => Promise<void>;
  /**
   * Used to mock API requests
   */
  // eslint-disable-next-line no-var
  var MockApiClient: typeof Client;
}

// needed by cbor-web for webauthn
window.TextEncoder = TextEncoder;
window.TextDecoder = TextDecoder as typeof window.TextDecoder;

// This is so we can use async/await in tests instead of wrapping with `setTimeout`.
window.tick = () => new Promise(resolve => setTimeout(resolve));

window.MockApiClient = await vi.importMock('sentry/api').then(m => m.Client);

window.scrollTo = vi.fn();

window.ra = {event: vi.fn()};

// We need to re-define `window.location`, otherwise we can't spyOn certain
// methods as `window.location` is read-only
Object.defineProperty(window, 'location', {
  value: {...window.location, assign: vi.fn(), reload: vi.fn(), replace: vi.fn()},
  configurable: true,
  writable: true,
});

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

// Using `:focus-visible` in `querySelector` or `matches` will throw an error in JSDOM.
// See https://github.com/jsdom/jsdom/issues/3055
// eslint-disable-next-line testing-library/no-node-access
const originalQuerySelector = HTMLElement.prototype.querySelector;
const originalMatches = HTMLElement.prototype.matches;
// eslint-disable-next-line testing-library/no-node-access
HTMLElement.prototype.querySelector = function (selectors: string) {
  if (selectors === ':focus-visible') {
    return null;
  }

  return originalQuerySelector.call(this, selectors);
};
HTMLElement.prototype.matches = function (selectors: string) {
  if (selectors === ':focus-visible') {
    return false;
  }

  return originalMatches.call(this, selectors);
};
