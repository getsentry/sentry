import type {InjectedRouter} from 'react-router';
import {stringify} from 'query-string';
import {LocationFixture} from 'sentry-fixture/locationFixture';

export function RouterFixture(params = {}): InjectedRouter {
  return {
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

        return `${to.pathname}?${stringify(to.query)}`;
      }

      return '';
    }),
    location: LocationFixture(),
    createPath: jest.fn(),
    routes: [],
    params: {},
    ...params,
  };
}

// TODO(epurkhiser): Remove once removed from getsentry
export default RouterFixture;
