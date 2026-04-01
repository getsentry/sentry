import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';
import {TimeSeriesFixture} from 'sentry-fixture/timeSeries';

import {render, screen, within} from 'sentry-test/reactTestingLibrary';

import {PageFiltersStore} from 'sentry/components/pageFilters/store';
import ScreenDetailsPage from 'sentry/views/insights/mobile/screens/views/screenDetailsPage';

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
  });
});
