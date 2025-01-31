import type {Location} from 'history';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import {render, screen, within} from 'sentry-test/reactTestingLibrary';

import {useLocation} from 'sentry/utils/useLocation';
import usePageFilters from 'sentry/utils/usePageFilters';
import {ScreenDetailsPage} from 'sentry/views/insights/mobile/screens/views/screenDetailsPage';

jest.mock('sentry/utils/usePageFilters');
jest.mock('sentry/utils/useLocation');

describe('ScreenDetailsPage', function () {
  const organization = OrganizationFixture({
    features: ['insights-addon-modules', 'insights-mobile-screens-module'],
  });
  const project = ProjectFixture();

  jest.mocked(useLocation).mockReturnValue({
    action: 'PUSH',
    hash: '',
    key: '',
    pathname: '/organizations/org-slug/performance/mobile/mobile-vitals/details',
    query: {
      project: project.id,
      transaction: 'HomeActivity',
    },
    search: '',
    state: undefined,
  } as Location);

  jest.mocked(usePageFilters).mockReturnValue({
    isReady: true,
    desyncedFilters: new Set(),
    pinnedFilters: new Set(),
    shouldPersist: true,
    selection: {
      datetime: {
        period: '10d',
        start: null,
        end: null,
        utc: false,
      },
      environments: [],
      projects: [parseInt(project.id, 10)],
    },
  });

  describe('Tabs', function () {
    beforeEach(() => {
      MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/events-stats/`,
      });

      MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/events/`,
      });

      MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/releases/`,
      });
    });

    afterEach(() => {
      MockApiClient.clearMockResponses();
      jest.clearAllMocks();
    });

    it('renders the tabs correctly', async function () {
      jest.mocked(useLocation).mockReturnValue({
        action: 'PUSH',
        hash: '',
        key: '',
        pathname: '/organizations/org-slug/performance/mobile/mobile-vitals/details',
        query: {
          project: project.id,
        },
        search: '',
        state: undefined,
      } as Location);

      render(<ScreenDetailsPage />, {organization});

      const tabs: string[] = ['App Start', 'Screen Load', 'Screen Rendering'];

      for (const tab of tabs) {
        expect(
          await within(await screen.findByRole('tablist')).findByText(tab)
        ).toBeVisible();
      }
    });
  });
});
