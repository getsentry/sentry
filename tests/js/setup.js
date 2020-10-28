/* global __dirname */
import jQuery from 'jquery';
import Adapter from 'enzyme-adapter-react-16';
import Enzyme from 'enzyme'; // eslint-disable-line no-restricted-imports
import MockDate from 'mockdate';
import PropTypes from 'prop-types';
import fromEntries from 'object.fromentries';

import ConfigStore from 'app/stores/configStore';

import {loadFixtures} from './sentry-test/loadFixtures';

export * from './sentry-test/select';

// We need this polyfill for testing only because
// typescript handles it for main application
fromEntries.shim();

/**
 * Enzyme configuration
 */
Enzyme.configure({adapter: new Adapter()});

/**
 * Mock (current) date to always be National Pasta Day
 * 2017-10-17T02:41:20.000Z
 */
const constantDate = new Date(1508208080000);
MockDate.set(constantDate);

/**
 * Load all files in `tests/js/fixtures/*` as a module.
 * These will then be added to the `TestStubs` global below
 */
const fixturesPath = `${__dirname}/sentry-test/fixtures`;
const fixtures = loadFixtures(fixturesPath);

/**
 * Global testing configuration
 */
ConfigStore.loadInitialData({
  messages: [],
  user: fixtures.User(),
});

/**
 * Mocks
 */
jest.mock('lodash/debounce', () => jest.fn(fn => fn));
jest.mock('app/utils/recreateRoute');
jest.mock('app/translations');
jest.mock('app/api');
jest.mock('app/utils/domId');
jest.mock('app/utils/withOrganization');
jest.mock('scroll-to-element', () => jest.fn());
jest.mock('react-router', () => {
  const ReactRouter = jest.requireActual('react-router');
  return {
    IndexRedirect: ReactRouter.IndexRedirect,
    IndexRoute: ReactRouter.IndexRoute,
    Link: ReactRouter.Link,
    Redirect: ReactRouter.Redirect,
    Route: ReactRouter.Route,
    withRouter: ReactRouter.withRouter,
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
    startTransaction: () => ({finish: jest.fn(), setTag: jest.fn()}),
  };
});

jest.mock('popper.js', () => {
  const PopperJS = jest.requireActual('popper.js');

  return class {
    static placements = PopperJS.placements;

    constructor() {
      return {
        destroy: () => {},
        scheduleUpdate: () => {},
      };
    }
  };
});

// We generally use actual jQuery, and jest mocks takes precedence over node_modules.
jest.unmock('jquery');

/**
 * Test Globals
 */

// This is so we can use async/await in tests instead of wrapping with `setTimeout`.
window.tick = () => new Promise(resolve => setTimeout(resolve));

window.$ = window.jQuery = jQuery;
window.scrollTo = jest.fn();

// This is very commonly used, so expose it globally.
window.MockApiClient = jest.requireMock('app/api').Client;

window.TestStubs = {
  // react-router's 'router' context
  router: (params = {}) => ({
    push: jest.fn(),
    replace: jest.fn(),
    go: jest.fn(),
    goBack: jest.fn(),
    goForward: jest.fn(),
    listen: jest.fn(),
    setRouteLeaveHook: jest.fn(),
    isActive: jest.fn(),
    createHref: jest.fn(),
    location: {query: {}},
    ...params,
  }),

  location: (params = {}) => ({
    query: {},
    pathame: '/mock-pathname/',
    ...params,
  }),

  routes: () => [
    {path: '/'},
    {path: '/:orgId/'},
    {name: 'this should be skipped'},
    {path: '/organizations/:orgId/'},
    {path: 'api-keys/', name: 'API Key'},
  ],

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
      organization: fixtures.Organization(),
      project: fixtures.Project(),
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

  AllAuthenticators: () => Object.values(fixtures.Authenticators()).map(x => x()),
  ...fixtures,
};
