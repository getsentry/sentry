import {createMemoryHistory, Route, Router, RouterContext} from 'react-router';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import {useParams} from 'sentry/utils/useParams';
import {useRouteContext} from 'sentry/utils/useRouteContext';
import {RouteContext} from 'sentry/views/routeContext';

const mockUsingCustomerDomain = jest.fn();
const mockCustomerDomain = jest.fn();

jest.mock('sentry/constants', () => {
  const sentryConstant = jest.requireActual('sentry/constants');
  return {
    ...sentryConstant,

    get usingCustomerDomain() {
      return mockUsingCustomerDomain();
    },

    get customerDomain() {
      return mockCustomerDomain();
    },
  };
});

describe('useParams', () => {
  describe('when the path has no params', () => {
    it('returns an empty object', () => {
      let params;
      function HomePage() {
        params = useParams();
        return null;
      }

      const memoryHistory = createMemoryHistory();
      memoryHistory.push('/?hello');

      render(
        <Router
          history={memoryHistory}
          render={props => {
            return (
              <RouteContext.Provider value={props}>
                <RouterContext {...props} />
              </RouteContext.Provider>
            );
          }}
        >
          <Route path="/" component={HomePage} />
        </Router>
      );

      expect(params).toEqual({});
    });
  });

  describe('when the path has some params', () => {
    it('returns an object of the URL params', () => {
      let params;
      function HomePage() {
        params = useParams();
        return null;
      }

      const memoryHistory = createMemoryHistory();
      memoryHistory.push('/sentry');

      render(
        <Router
          history={memoryHistory}
          render={props => {
            return (
              <RouteContext.Provider value={props}>
                <RouterContext {...props} />
              </RouteContext.Provider>
            );
          }}
        >
          <Route path="/:slug" component={HomePage} />
        </Router>
      );
      expect(params).toEqual({slug: 'sentry'});
    });
  });

  describe('customer domains', function () {
    afterEach(function () {
      jest.resetAllMocks();
    });

    it('populates orgId when customer domain is being used', function () {
      mockUsingCustomerDomain.mockReturnValue(true);
      mockCustomerDomain.mockReturnValue('albertos-apples');

      let originalParams;
      let useParamsValue;

      function Component() {
        const {params} = useRouteContext();
        originalParams = params;
        useParamsValue = useParams();
        return (
          <div>rendered component for org: {useParamsValue.orgId ?? 'no org id'}</div>
        );
      }

      const memoryHistory = createMemoryHistory();
      memoryHistory.push('/issues/?hello');

      render(
        <Router
          history={memoryHistory}
          render={props => {
            return (
              <RouteContext.Provider value={props}>
                <RouterContext {...props} />
              </RouteContext.Provider>
            );
          }}
        >
          <Route path="/issues/" component={Component} />
        </Router>
      );

      expect(
        screen.getByText('rendered component for org: albertos-apples')
      ).toBeInTheDocument();
      expect(originalParams).toEqual({});
      expect(useParamsValue).toEqual({
        orgId: 'albertos-apples',
      });
    });

    it('does not populate orgId when customer domain is not being used', function () {
      mockUsingCustomerDomain.mockReturnValue(false);
      mockCustomerDomain.mockReturnValue(undefined);

      let originalParams;
      let useParamsValue;

      function Component() {
        const {params} = useRouteContext();
        originalParams = params;
        useParamsValue = useParams();
        return (
          <div>rendered component for org: {useParamsValue.orgId ?? 'no org id'}</div>
        );
      }

      const memoryHistory = createMemoryHistory();
      memoryHistory.push('/issues/?hello');

      render(
        <Router
          history={memoryHistory}
          render={props => {
            return (
              <RouteContext.Provider value={props}>
                <RouterContext {...props} />
              </RouteContext.Provider>
            );
          }}
        >
          <Route path="/issues/" component={Component} />
        </Router>
      );

      expect(
        screen.getByText('rendered component for org: no org id')
      ).toBeInTheDocument();
      expect(originalParams).toEqual({});
      expect(useParamsValue).toEqual({});
    });
  });
});
