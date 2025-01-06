import {LocationFixture} from 'sentry-fixture/locationFixture';
import {RouterFixture} from 'sentry-fixture/routerFixture';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import type {RouteContextInterface} from 'sentry/types/legacyReactRouter';
import {useParams} from 'sentry/utils/useParams';
import {useTestRouteContext} from 'sentry/utils/useRouteContext';
import {TestRouteContext} from 'sentry/views/routeContext';

const mockUsingCustomerDomain = jest.fn();
const mockCustomerDomain = jest.fn();

jest.mock('sentry/constants', () => {
  const sentryConstant = jest.requireActual('sentry/constants');
  return {
    ...sentryConstant,

    get USING_CUSTOMER_DOMAIN() {
      return mockUsingCustomerDomain();
    },

    get CUSTOMER_DOMAIN() {
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

      const routeContext: RouteContextInterface = {
        location: LocationFixture(),
        params: {},
        router: RouterFixture(),
        routes: [],
      };

      render(
        <TestRouteContext.Provider value={routeContext}>
          <HomePage />
        </TestRouteContext.Provider>
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

      const routeContext: RouteContextInterface = {
        location: LocationFixture(),
        params: {slug: 'sentry'},
        router: RouterFixture(),
        routes: [],
      };

      render(
        <TestRouteContext.Provider value={routeContext}>
          <HomePage />
        </TestRouteContext.Provider>
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
        const {params} = useTestRouteContext()!;
        originalParams = params;
        useParamsValue = useParams();
        return (
          <div>rendered component for org: {useParamsValue.orgId ?? 'no org id'}</div>
        );
      }

      const routeContext: RouteContextInterface = {
        location: LocationFixture(),
        params: {},
        router: RouterFixture(),
        routes: [],
      };

      render(
        <TestRouteContext.Provider value={routeContext}>
          <Component />
        </TestRouteContext.Provider>
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
        const {params} = useTestRouteContext()!;
        originalParams = params;
        useParamsValue = useParams();
        return (
          <div>rendered component for org: {useParamsValue.orgId ?? 'no org id'}</div>
        );
      }

      const routeContext: RouteContextInterface = {
        location: LocationFixture(),
        params: {},
        router: RouterFixture(),
        routes: [],
      };

      render(
        <TestRouteContext.Provider value={routeContext}>
          <Component />
        </TestRouteContext.Provider>
      );

      expect(
        screen.getByText('rendered component for org: no org id')
      ).toBeInTheDocument();
      expect(originalParams).toEqual({});
      expect(useParamsValue).toEqual({});
    });
  });
});
