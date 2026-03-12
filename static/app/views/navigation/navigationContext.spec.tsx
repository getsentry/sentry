import {getNavigationGroupFromPath} from 'sentry/views/navigation/navigationContext';
import {PrimaryNavigationGroup} from 'sentry/views/navigation/types';

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

describe('getNavigationGroupFromPath', () => {
  beforeEach(() => {
    mockUsingCustomerDomain.mockReturnValue(true);
  });

  describe('customer domain', () => {
    it.each([
      [PrimaryNavigationGroup.ISSUES, '/issues/foo/'],
      [PrimaryNavigationGroup.EXPLORE, '/explore/foo/'],
      [PrimaryNavigationGroup.DASHBOARDS, '/dashboards/'],
      [PrimaryNavigationGroup.DASHBOARDS, '/dashboard/foo/'],
      [PrimaryNavigationGroup.INSIGHTS, '/insights/foo/'],
      [PrimaryNavigationGroup.SETTINGS, '/settings/foo/'],
      [PrimaryNavigationGroup.PREVENT, '/prevent/foo/'],
    ])('correctly matches %s nav group', (navigationGroup, path) => {
      expect(getNavigationGroupFromPath(path)).toBe(navigationGroup);
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
    ])('correctly matches %s nav group', (navigationGroup, path) => {
      mockUsingCustomerDomain.mockReturnValue(false);
      expect(getNavigationGroupFromPath(path)).toBe(navigationGroup);
    });
  });
});
