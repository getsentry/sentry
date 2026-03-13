import {render, screen} from 'sentry-test/reactTestingLibrary';

import {useActiveNavigationGroup} from 'sentry/views/navigation/useActiveNavigationGroup';

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

describe('useActiveNavigationGroup', () => {
  beforeEach(() => {
    mockUsingCustomerDomain.mockReturnValue(true);
  });

  function TestComponent() {
    const activeNavigationGroup = useActiveNavigationGroup();

    return <div>{activeNavigationGroup}</div>;
  }

  describe('customer domain', () => {
    it.each([
      ['issues', '/issues/foo/'],
      ['explore', '/explore/foo/'],
      ['dashboards', '/dashboards/'],
      ['dashboards', '/dashboard/foo/'],
      ['insights', '/insights/foo/'],
      ['settings', '/settings/foo/'],
      ['prevent', '/prevent/foo/'],
    ])('correctly matches %s nav group', async (navigationGroup, path) => {
      render(<TestComponent />, {
        initialRouterConfig: {
          location: {
            pathname: path,
          },
        },
      });

      expect(await screen.findByText(navigationGroup)).toBeInTheDocument();
    });
  });

  describe('non-customer domain', () => {
    it.each([
      ['issues', '/organizations/org-slug/issues/foo/'],
      ['explore', '/organizations/org-slug/explore/foo/'],
      ['dashboards', '/organizations/org-slug/dashboards/'],
      ['dashboards', '/organizations/org-slug/dashboard/foo/'],
      ['insights', '/organizations/org-slug/insights/foo/'],
      ['settings', '/organizations/org-slug/settings/foo/'],
      ['settings', '/settings/account/details/'],
      ['prevent', '/organizations/org-slug/prevent/foo/'],
    ])('correctly matches %s nav group', async (navigationGroup, path) => {
      mockUsingCustomerDomain.mockReturnValue(false);
      render(<TestComponent />, {
        initialRouterConfig: {
          location: {
            pathname: path,
          },
        },
      });

      expect(await screen.findByText(navigationGroup)).toBeInTheDocument();
    });
  });
});
