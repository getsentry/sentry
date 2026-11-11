import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';
import {TimeSeriesFixture} from 'sentry-fixture/timeSeries';

import {
  render,
  screen,
  userEvent,
  waitFor,
  within,
} from 'sentry-test/reactTestingLibrary';

import {PageFiltersStore} from 'sentry/components/pageFilters/store';

import ScreenDetailsPage from './screenDetailsPage';

jest.mock('sentry/views/dashboards/prebuiltDashboardRenderer', () => ({
  PrebuiltDashboardRenderer: () => <div data-test-id="prebuilt-dashboard" />,
}));

describe('ScreenDetailsPage', () => {
  const organization = OrganizationFixture({
    features: ['insight-modules'],
  });
  const project = ProjectFixture();

  beforeEach(() => {
    PageFiltersStore.onInitializeUrlState({
      projects: [parseInt(project.id, 10)],
      environments: [],
      datetime: {
        period: '10d',
        start: null,
        end: null,
        utc: false,
      },
    });
  });

  describe('Tabs', () => {
    beforeEach(() => {
      MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/events-timeseries/`,
        body: {
          timeSeries: [
            TimeSeriesFixture({
              yAxis: 'epm()',
            }),
          ],
        },
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

    it('renders the tabs correctly', async () => {
      render(<ScreenDetailsPage />, {organization});

      const tabs: string[] = ['App Start', 'Screen Load', 'Screen Rendering'];

      for (const tab of tabs) {
        expect(
          await within(await screen.findByRole('tablist')).findByText(tab)
        ).toBeVisible();
      }
    });

    it('pushes the selected tab and drops tab-specific params when a tab is clicked', async () => {
      const {router} = render(<ScreenDetailsPage />, {
        organization,
        initialRouterConfig: {
          location: {
            pathname: '/insights/mobile/mobile-vitals/details/',
            query: {
              transaction: 'MainActivity',
              tab: 'app_start',
              sort: '-count()',
              'span.op': 'ui.load',
              project: '1',
            },
          },
        },
      });

      await userEvent.click(await screen.findByRole('tab', {name: 'Screen Load'}));
      await waitFor(() => expect(router.location.query.tab).toBe('screen_load'));
      const queryAfterClick = router.location.query;
      router.navigate(-1);

      expect(queryAfterClick).toEqual({
        transaction: 'MainActivity',
        tab: 'screen_load',
        project: '1',
      });
      await waitFor(() => expect(router.location.query.tab).toBe('app_start'));
    });
  });
});
