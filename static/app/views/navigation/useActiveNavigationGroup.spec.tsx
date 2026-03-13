import {render, screen} from 'sentry-test/reactTestingLibrary';

import {PrimaryNavigationGroup} from 'sentry/views/navigation/types';
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
      [PrimaryNavigationGroup.ISSUES, '/issues/foo/'],
      [PrimaryNavigationGroup.EXPLORE, '/explore/foo/'],
      [PrimaryNavigationGroup.DASHBOARDS, '/dashboards/'],
      [PrimaryNavigationGroup.DASHBOARDS, '/dashboard/foo/'],
      [PrimaryNavigationGroup.INSIGHTS, '/insights/foo/'],
      [PrimaryNavigationGroup.SETTINGS, '/settings/foo/'],
      [PrimaryNavigationGroup.PREVENT, '/prevent/foo/'],
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
      [PrimaryNavigationGroup.ISSUES, '/organizations/org-slug/issues/foo/'],
      [PrimaryNavigationGroup.EXPLORE, '/organizations/org-slug/explore/foo/'],
      [PrimaryNavigationGroup.DASHBOARDS, '/organizations/org-slug/dashboards/'],
      [PrimaryNavigationGroup.DASHBOARDS, '/organizations/org-slug/dashboard/foo/'],
      [PrimaryNavigationGroup.INSIGHTS, '/organizations/org-slug/insights/foo/'],
      [PrimaryNavigationGroup.SETTINGS, '/organizations/org-slug/settings/foo/'],
      [PrimaryNavigationGroup.SETTINGS, '/settings/account/details/'],
      [PrimaryNavigationGroup.PREVENT, '/organizations/org-slug/prevent/foo/'],
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
