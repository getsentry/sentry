import {render, screen} from 'sentry-test/reactTestingLibrary';

import {PrimaryNavGroup} from 'sentry/views/nav/types';
import {useActiveNavGroup} from 'sentry/views/nav/useActiveNavGroup';

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

describe('useActiveNavGroup', function () {
  beforeEach(() => {
    mockUsingCustomerDomain.mockReturnValue(true);
  });

  function TestComponent() {
    const activeNavGroup = useActiveNavGroup();

    return <div>{activeNavGroup}</div>;
  }

  describe('customer domain', function () {
    it.each([
      [PrimaryNavGroup.ISSUES, '/issues/foo/'],
      [PrimaryNavGroup.EXPLORE, '/explore/foo/'],
      [PrimaryNavGroup.DASHBOARDS, '/dashboards/foo/'],
      [PrimaryNavGroup.INSIGHTS, '/insights/foo/'],
      [PrimaryNavGroup.SETTINGS, '/settings/foo/'],
      [PrimaryNavGroup.PIPELINE, '/pipeline/foo/'],
    ])('correctly matches %s nav group', async function (navGroup, path) {
      render(<TestComponent />, {
        disableRouterMocks: true,
        initialRouterConfig: {
          location: {
            pathname: path,
          },
        },
      });

      expect(await screen.findByText(navGroup)).toBeInTheDocument();
    });
  });

  describe('non-customer domain', function () {
    it.each([
      [PrimaryNavGroup.ISSUES, '/organizations/org-slug/issues/foo/'],
      [PrimaryNavGroup.EXPLORE, '/organizations/org-slug/explore/foo/'],
      [PrimaryNavGroup.DASHBOARDS, '/organizations/org-slug/dashboards/foo/'],
      [PrimaryNavGroup.INSIGHTS, '/organizations/org-slug/insights/foo/'],
      [PrimaryNavGroup.SETTINGS, '/organizations/org-slug/settings/foo/'],
      [PrimaryNavGroup.PIPELINE, '/organizations/org-slug/pipeline/foo/'],
    ])('correctly matches %s nav group', async function (navGroup, path) {
      mockUsingCustomerDomain.mockReturnValue(false);
      render(<TestComponent />, {
        disableRouterMocks: true,
        initialRouterConfig: {
          location: {
            pathname: path,
          },
        },
      });

      expect(await screen.findByText(navGroup)).toBeInTheDocument();
    });
  });
});
