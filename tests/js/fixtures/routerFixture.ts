import type {InjectedRouter} from 'sentry/types/legacyReactRouter';
import {stringify} from 'query-string';
import {LocationFixture} from 'sentry-fixture/locationFixture';
import type {Location} from 'history';

interface RouterFixtureProps {
  push?: any;
  replace?: any;
  routes?: InjectedRouter['routes'];
  /**
   * Accessed via `router.params` or useParams
   */
  params?: Record<string, string | undefined>;
  /**
   * `router.location` or useLocation
   */
  location?: Partial<Location>;
}

export function RouterFixture(params: RouterFixtureProps = {}): InjectedRouter {
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
    createPath: jest.fn(),
    routes: [],
    ...params,
    // Filter out undefined values
    params: Object.fromEntries(
      Object.entries(params.params ?? {}).filter(
        (pair): pair is [string, string] => pair[1] !== undefined
      )
    ),
    location: LocationFixture(params.location),
  };
}
