import {useParams as useReactRouter6Params} from 'react-router-dom';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import {useParams} from 'sentry/utils/useParams';

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
      let params: any;
      function HomePage() {
        params = useParams();
        return null;
      }

      render(<HomePage />, {
        initialRouterConfig: {
          route: '/issues/',
          location: {pathname: '/issues/'},
        },
      });

      expect(params).toEqual({});
    });
  });

  describe('when the path has some params', () => {
    it('returns an object of the URL params', () => {
      let params: any;
      function HomePage() {
        params = useParams();
        return null;
      }

      render(<HomePage />, {
        initialRouterConfig: {
          route: '/organizations/:slug/',
          location: {pathname: '/organizations/sentry/'},
        },
      });
      expect(params).toEqual({slug: 'sentry'});
    });
  });

  describe('customer domains', () => {
    afterEach(() => {
      jest.resetAllMocks();
    });

    it('populates orgId when customer domain is being used', () => {
      mockUsingCustomerDomain.mockReturnValue(true);
      mockCustomerDomain.mockReturnValue('albertos-apples');

      let originalParams: any;
      let useParamsValue: any;

      function Component() {
        originalParams = useReactRouter6Params();
        useParamsValue = useParams();
        return (
          <div>rendered component for org: {useParamsValue.orgId ?? 'no org id'}</div>
        );
      }

      render(<Component />, {
        initialRouterConfig: {
          route: '/issues/',
          location: {pathname: '/issues/'},
        },
      });

      expect(
        screen.getByText('rendered component for org: albertos-apples')
      ).toBeInTheDocument();
      expect(originalParams).toEqual({});
      expect(useParamsValue).toEqual({
        orgId: 'albertos-apples',
      });
    });

    it('does not populate orgId when customer domain is not being used', () => {
      mockUsingCustomerDomain.mockReturnValue(false);
      mockCustomerDomain.mockReturnValue(undefined);

      let originalParams: any;
      let useParamsValue: any;

      function Component() {
        originalParams = useReactRouter6Params();
        useParamsValue = useParams();
        return (
          <div>rendered component for org: {useParamsValue.orgId ?? 'no org id'}</div>
        );
      }

      render(<Component />, {
        initialRouterConfig: {
          route: '/issues/',
          location: {pathname: '/issues/'},
        },
      });

      expect(
        screen.getByText('rendered component for org: no org id')
      ).toBeInTheDocument();
      expect(originalParams).toEqual({});
      expect(useParamsValue).toEqual({});
    });
  });
});
