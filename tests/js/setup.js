/* global __dirname */
import {channel, createBroadcast} from 'emotion-theming';
import jQuery from 'jquery';
import sinon from 'sinon';
import Adapter from 'enzyme-adapter-react-16';
import Enzyme from 'enzyme';
import MockDate from 'mockdate';
import PropTypes from 'prop-types';

import ConfigStore from 'app/stores/configStore';
import theme from 'app/utils/theme';

import {loadFixtures} from './helpers/loadFixtures';

export * from './helpers/select';

/**
 * Enzyme configuration
 */
Enzyme.configure({adapter: new Adapter()});
Enzyme.configure({disableLifecycleMethods: true});

/**
 * Mock (current) date to alway be below
 */
const constantDate = new Date(1508208080000); //National Pasta Day
MockDate.set(constantDate);

/**
 * emotion setup for theme provider in context
 */
const broadcast = createBroadcast(theme);

/**
 * Load all files in `tests/js/fixtures/*` as a module.
 * These will then be added to the `TestStubs` global below
 */
const fixturesPath = `${__dirname}/fixtures`;
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
jest.mock('app/utils/withOrganization');
jest.mock('scroll-to-element', () => {});
jest.mock('react-router', () => {
  const ReactRouter = require.requireActual('react-router');
  return {
    IndexRedirect: ReactRouter.IndexRedirect,
    IndexRoute: ReactRouter.IndexRoute,
    Link: ReactRouter.Link,
    Redirect: ReactRouter.Redirect,
    Route: ReactRouter.Route,
    withRouter: ReactRouter.withRouter,
    browserHistory: {
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
  const ActualReactVirtualized = require.requireActual('react-virtualized');
  return {
    ...ActualReactVirtualized,
    AutoSizer: ({children}) => {
      return children({width: 100, height: 100});
    },
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

jest.mock('app/utils/sdk', () => ({
  captureMessage: jest.fn(),
  captureException: jest.fn(),
  showReportDialog: jest.fn(),
  lastEventId: jest.fn(),
}));

// We generally use actual jQuery, and jest mocks takes precedence over node_modules
jest.unmock('jquery');

/**
 * Test Globals
 */

// This is so we can use async/await in tests instead of wrapping with `setTimeout`
window.tick = () => new Promise(resolve => setTimeout(resolve));

window.$ = window.jQuery = jQuery;
window.sinon = sinon;
window.scrollTo = jest.fn();

// this is very commonly used, so expose it globally
window.MockApiClient = require.requireMock('app/api').Client;

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
      [channel]: {
        subscribe: broadcast.subscribe,
        unsubscribe: broadcast.unsubscribe,
      },
      location: TestStubs.location(),
      router: TestStubs.router(),
      organization: fixtures.Organization(),
      project: fixtures.Project(),
      ...context,
    },
    childContextTypes: {
      [channel]: PropTypes.object,
      router: PropTypes.object,
      location: PropTypes.object,
      organization: PropTypes.object,
      project: PropTypes.object,
      ...childContextTypes,
    },
  }),

  AllAuthenticators: () => {
    return Object.values(fixtures.Authenticators()).map(x => x());
  },
  ...fixtures,
};
