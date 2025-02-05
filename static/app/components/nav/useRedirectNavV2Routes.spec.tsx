import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import {useRedirectNavV2Routes} from 'sentry/components/nav/useRedirectNavV2Routes';

const mockUsingCustomerDomain = jest.fn();

jest.mock('sentry/constants', () => {
  const sentryConstant = jest.requireActual('sentry/constants');
  return {
    ...sentryConstant,

    get USING_CUSTOMER_DOMAIN() {
      return mockUsingCustomerDomain();
    },
  };
});

describe('useRedirectNavV2Routes', () => {
  function TestComponent({
    oldPathPrefix,
    newPathPrefix,
  }: {
    newPathPrefix: `/${string}`;
    oldPathPrefix: `/${string}`;
  }) {
    const redirectPath = useRedirectNavV2Routes({
      oldPathPrefix,
      newPathPrefix,
    });

    return <div>{redirectPath ?? 'no redirect'}</div>;
  }

  const organization = OrganizationFixture({
    slug: 'org-slug',
    features: ['navigation-sidebar-v2'],
  });

  describe('customer domain', () => {
    beforeEach(() => {
      mockUsingCustomerDomain.mockReturnValue(true);
    });

    it('should not redirect if no navigation v2', () => {
      render(
        <TestComponent oldPathPrefix="/projects/" newPathPrefix="/insights/projects/" />,
        {
          organization: OrganizationFixture({
            slug: 'org-slug',
            features: [],
          }),
          disableRouterMocks: true,
          initialRouterConfig: {
            location: {
              pathname: '/projects/123/',
            },
          },
        }
      );

      expect(screen.getByText('no redirect')).toBeInTheDocument();
    });

    it('should redirect on match', () => {
      render(
        <TestComponent oldPathPrefix="/projects/" newPathPrefix="/insights/projects/" />,
        {
          organization,
          disableRouterMocks: true,
          initialRouterConfig: {
            location: {
              pathname: '/projects/123/',
              query: {foo: 'bar'},
            },
          },
        }
      );

      expect(screen.getByText('/insights/projects/123/?foo=bar')).toBeInTheDocument();
    });

    it('should not redirect if no match', () => {
      render(
        <TestComponent oldPathPrefix="/projects/" newPathPrefix="/insights/projects/" />,
        {
          organization,
          disableRouterMocks: true,
          initialRouterConfig: {
            location: {
              pathname: '/other-projects/123/',
            },
          },
        }
      );

      expect(screen.getByText('no redirect')).toBeInTheDocument();
    });
  });

  describe('non-customer domain', () => {
    beforeEach(() => {
      mockUsingCustomerDomain.mockReturnValue(false);
    });

    it('should redirect on match', () => {
      render(
        <TestComponent oldPathPrefix="/projects/" newPathPrefix="/insights/projects/" />,
        {
          organization,
          disableRouterMocks: true,
          initialRouterConfig: {
            location: {
              pathname: '/organizations/org-slug/projects/123/',
              query: {foo: 'bar'},
            },
          },
        }
      );

      expect(
        screen.getByText('/organizations/org-slug/insights/projects/123/?foo=bar')
      ).toBeInTheDocument();
    });

    it('should not redirect if no match', () => {
      render(
        <TestComponent oldPathPrefix="/projects/" newPathPrefix="/insights/projects/" />,
        {
          organization,
          disableRouterMocks: true,
          initialRouterConfig: {
            location: {
              pathname: '/organizations/org-slug/other-projects/123/',
              query: {foo: 'bar'},
            },
          },
        }
      );

      expect(screen.getByText('no redirect')).toBeInTheDocument();
    });
  });
});
