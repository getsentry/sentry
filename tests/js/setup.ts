'use strict';
import '@testing-library/jest-dom';

import type {ReactElement} from 'react';
import {configure as configureRtl} from '@testing-library/react'; // eslint-disable-line no-restricted-imports
import {enableFetchMocks} from 'jest-fetch-mock';
import {webcrypto} from 'node:crypto';
import {TextDecoder, TextEncoder} from 'node:util';
import {ConfigFixture} from 'sentry-fixture/config';

import {resetMockDate} from 'sentry-test/utils';

// eslint-disable-next-line jest/no-mocks-import
import type {Client} from 'sentry/__mocks__/api';
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
jest.mock('lodash/debounce', () =>
  jest.fn(fn => {
    fn.cancel = jest.fn();
    return fn;
  })
);
jest.mock('sentry/utils/recreateRoute');
jest.mock('sentry/api');
jest
  .spyOn(performanceForSentry, 'VisuallyCompleteWithData')
  .mockImplementation(props => props.children as ReactElement);
jest.mock('scroll-to-element', () => jest.fn());

DANGEROUS_SET_TEST_HISTORY({
  goBack: jest.fn(),
  push: jest.fn(),
  replace: jest.fn(),
  listen: jest.fn(() => {}),
  listenBefore: jest.fn(),
  getCurrentLocation: jest.fn(() => ({pathname: '', query: {}})),
});

jest.mock('react-virtualized', function reactVirtualizedMockFactory() {
  const ActualReactVirtualized = jest.requireActual('react-virtualized');
  return {
    ...ActualReactVirtualized,
    AutoSizer: ({
      children,
    }: {
      children: (props: {height: number; width: number}) => React.ReactNode;
    }) => children({width: 100, height: 100}),
  };
});

jest.mock('echarts-for-react/lib/core', function echartsMockFactory() {
  // We need to do this because `jest.mock` gets hoisted by babel and `React` is not
  // guaranteed to be in scope
  const ReactActual = require('react');

  // We need a class component here because `BaseChart` passes `ref` which will
  // error if we return a stateless/functional component
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
      increment: jest.fn(),
      gauge: jest.fn(),
      set: jest.fn(),
      distribution: jest.fn(),
    },
    reactRouterV6BrowserTracingIntegration: jest.fn().mockReturnValue({}),
    browserTracingIntegration: jest.fn().mockReturnValue({}),
    browserProfilingIntegration: jest.fn().mockReturnValue({}),
    addEventProcessor: jest.fn(),
    BrowserClient: jest.fn().mockReturnValue({
      captureEvent: jest.fn(),
    }),
    startInactiveSpan: () => ({
      end: jest.fn(),
      setStatus: jest.fn(),
      startChild: jest.fn().mockReturnValue({
        end: jest.fn(),
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

window.MockApiClient = jest.requireMock('sentry/api').Client;

window.scrollTo = jest.fn();

// We need to re-define `window.location`, otherwise we can't spyOn certain
// methods as `window.location` is read-only
Object.defineProperty(window, 'location', {
  value: {...window.location, assign: jest.fn(), reload: jest.fn(), replace: jest.fn()},
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
  takeRecords = jest.fn();

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
