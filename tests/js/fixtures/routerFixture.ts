import type {InjectedRouter} from 'sentry/types/legacyReactRouter';
import {stringify} from 'query-string';
import {LocationFixture} from 'sentry-fixture/locationFixture';

export function RouterFixture(params = {}): InjectedRouter {
  return {
    push: vi.fn(),
    replace: vi.fn(),
    go: vi.fn(),
    goBack: vi.fn(),
    goForward: vi.fn(),
    setRouteLeaveHook: vi.fn(),
    isActive: vi.fn(),
    createHref: vi.fn().mockImplementation(to => {
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
    createPath: vi.fn(),
    routes: [],
    params: {},
    ...params,
  };
}
