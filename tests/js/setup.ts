/* eslint-env node */
/* eslint import/no-nodejs-modules:0 */
import path from 'path';
import {TextDecoder, TextEncoder} from 'util';

import {InjectedRouter} from 'react-router';
import {configure as configureRtl} from '@testing-library/react'; // eslint-disable-line no-restricted-imports
import Adapter from '@wojtekmaj/enzyme-adapter-react-17';
import {configure as configureEnzyme} from 'enzyme'; // eslint-disable-line no-restricted-imports
import {Location} from 'history';
import MockDate from 'mockdate';
import * as PropTypes from 'prop-types';
import * as qs from 'query-string';

// eslint-disable-next-line jest/no-mocks-import
import type {Client} from 'sentry/__mocks__/api';
import ConfigStore from 'sentry/stores/configStore';

import {makeLazyFixtures} from './sentry-test/loadFixtures';

// needed by cbor-web for webauthn
window.TextEncoder = TextEncoder;
window.TextDecoder = TextDecoder as typeof window.TextDecoder;

/**
 * XXX(epurkhiser): Gross hack to fix a bug in jsdom which makes testing of
 * framer-motion SVG components fail
 *
 * See https://github.com/jsdom/jsdom/issues/1330
 */
// @ts-expect-error
SVGElement.prototype.getTotalLength ??= () => 1;

/**
 * React Testing Library configuration to override the default test id attribute
 *
 * See: https://testing-library.com/docs/queries/bytestid/#overriding-data-testid
 */
configureRtl({testIdAttribute: 'data-test-id'});

/**
 * Enzyme configuration
 *
 * TODO(epurkhiser): We're using @wojtekmaj's react-17 enzyme adapter, until
 * the official adapter has been released.
 *
 * https://github.com/enzymejs/enzyme/issues/2429
 */
configureEnzyme({adapter: new Adapter()});

/**
 * Mock (current) date to always be National Pasta Day
 * 2017-10-17T02:41:20.000Z
 */
const constantDate = new Date(1508208080000);
MockDate.set(constantDate);

/**
 * Global testing configuration
 */

/**
 * Mocks
 */
jest.mock('lodash/debounce', () => jest.fn(fn => fn));
jest.mock('sentry/utils/recreateRoute');
jest.mock('sentry/api');
jest.mock('sentry/utils/withOrganization');
jest.mock('scroll-to-element', () => jest.fn());
jest.mock('react-router', () => {
  const ReactRouter = jest.requireActual('react-router');
  return {
    ...ReactRouter,
    browserHistory: {
      goBack: jest.fn(),
      push: jest.fn(),
      replace: jest.fn(),
      listen: jest.fn(() => {}),
    },
  };
});
jest.mock('react-lazyload', () => {
  const LazyLoadMock = ({children}) => children;
  return LazyLoadMock;
});

jest.mock('react-virtualized', () => {
  const ActualReactVirtualized = jest.requireActual('react-virtualized');
  return {
    ...ActualReactVirtualized,
    AutoSizer: ({children}) => children({width: 100, height: 100}),
  };
});

jest.mock('echarts-for-react/lib/core', () => {
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

jest.mock('@sentry/react', () => {
  const SentryReact = jest.requireActual('@sentry/react');
  return {
    init: jest.fn(),
    configureScope: jest.fn(),
    setTag: jest.fn(),
    setTags: jest.fn(),
    setExtra: jest.fn(),
    setExtras: jest.fn(),
    captureBreadcrumb: jest.fn(),
    addBreadcrumb: jest.fn(),
    captureMessage: jest.fn(),
    captureException: jest.fn(),
    showReportDialog: jest.fn(),
    startSpan: jest.fn(),
    finishSpan: jest.fn(),
    lastEventId: jest.fn(),
    getCurrentHub: jest.spyOn(SentryReact, 'getCurrentHub'),
    withScope: jest.spyOn(SentryReact, 'withScope'),
    Severity: SentryReact.Severity,
    withProfiler: SentryReact.withProfiler,
    BrowserClient: jest.fn().mockReturnValue({
      captureEvent: jest.fn(),
    }),
    startTransaction: () => ({
      finish: jest.fn(),
      setTag: jest.fn(),
      setData: jest.fn(),
      setStatus: jest.fn(),
      startChild: jest.fn().mockReturnValue({
        finish: jest.fn(),
      }),
    }),
  };
});

const routerFixtures = {
  router: (params = {}): InjectedRouter => ({
    push: jest.fn(),
    replace: jest.fn(),
    go: jest.fn(),
    goBack: jest.fn(),
    goForward: jest.fn(),
    setRouteLeaveHook: jest.fn(),
    isActive: jest.fn(),
    createHref: jest.fn().mockImplementation(to => {
      if (typeof to === 'string') {
        return to;
      }

      if (typeof to === 'object') {
        if (!to.query) {
          return to.pathname;
        }

        return `${to.pathname}?${qs.stringify(to.query)}`;
      }

      return '';
    }),
    location: TestStubs.location(),
    createPath: jest.fn(),
    routes: [],
    params: {},
    ...params,
  }),

  location: (params: Partial<Location> = {}): Location => ({
    key: '',
    search: '',
    hash: '',
    action: 'PUSH',
    state: null,
    query: {},
    pathname: '/mock-pathname/',
    ...params,
  }),

  routerProps: (params = {}) => ({
    location: TestStubs.location(),
    params: {},
    routes: [],
    stepBack: () => {},
    ...params,
  }),

  routerContext: ([context, childContextTypes] = []) => ({
    context: {
      location: TestStubs.location(),
      router: TestStubs.router(),
      organization: TestStubs.Organization(),
      project: TestStubs.Project(),
      ...context,
    },
    childContextTypes: {
      router: PropTypes.object,
      location: PropTypes.object,
      organization: PropTypes.object,
      project: PropTypes.object,
      ...childContextTypes,
    },
  }),
};

const jsFixturesDirectory = path.resolve(__dirname, '../../fixtures/js-stubs/');
const fixtures = makeLazyFixtures(jsFixturesDirectory, routerFixtures);

ConfigStore.loadInitialData(fixtures.Config());

/**
 * Test Globals
 */
declare global {
  /**
   * Test stubs are automatically loaded from the fixtures/js-stubs
   * directory. Use these for setting up test data.
   */
  // eslint-disable-next-line no-var
  var TestStubs: typeof fixtures;
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

window.TestStubs = fixtures;

// This is so we can use async/await in tests instead of wrapping with `setTimeout`.
window.tick = () => new Promise(resolve => setTimeout(resolve));

window.MockApiClient = jest.requireMock('sentry/api').Client;

window.scrollTo = jest.fn();

// We need to re-define `window.location`, otherwise we can't spyOn certain
// methods as `window.location` is read-only
Object.defineProperty(window, 'location', {
  value: {...window.location, assign: jest.fn(), reload: jest.fn()},
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
