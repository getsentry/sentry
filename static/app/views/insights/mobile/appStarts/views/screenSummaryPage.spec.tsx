import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';
import {TimeSeriesFixture} from 'sentry-fixture/timeSeries';

import {render, screen, waitFor, within} from 'sentry-test/reactTestingLibrary';

import PageFiltersStore from 'sentry/stores/pageFiltersStore';
import {ScreenSummaryContentPage} from 'sentry/views/insights/mobile/appStarts/views/screenSummaryPage';
import {SpanFields} from 'sentry/views/insights/types';

describe('Screen Summary', () => {
  const organization = OrganizationFixture();
  const project = ProjectFixture();

  const initialRouterConfig = {
    location: {
      pathname: `/organizations/${organization.slug}/insights/screens/spans/`,
      query: {
        project: project.id,
        transaction: 'MainActivity',
        primaryRelease: 'com.example.vu.android@2.10.5',
        [SpanFields.APP_START_TYPE]: 'cold',
      },
    },
    route: `/organizations/:orgId/insights/screens/spans/`,
  };

  describe('Native Project', () => {
    let eventsMock: jest.Mock;

    beforeEach(() => {
      PageFiltersStore.init();
      PageFiltersStore.onInitializeUrlState({
        projects: [parseInt(project.id, 10)],
        environments: [],
        datetime: {period: '10d', start: null, end: null, utc: false},
      });

      MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/releases/`,
        body: [
          {
            id: 970136705,
            version: 'com.example.vu.android@2.10.5',
            dateCreated: '2023-12-19T21:37:53.895495Z',
          },
          {
            id: 969902997,
            version: 'com.example.vu.android@2.10.3+42',
            dateCreated: '2023-12-19T18:04:06.953025Z',
          },
        ],
      });
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
      eventsMock = MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/events/`,
      });
    });

    afterEach(() => {
      MockApiClient.clearMockResponses();
      jest.clearAllMocks();
    });

    it('renders the top level metrics data correctly', async () => {
      eventsMock = MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/events/`,
        body: {
          data: [
            {
              'span.op': 'app.start.cold',
              'avg_if(span.duration,release,equals,com.example.vu.android@2.10.5)': 1000,
              'count_if(release,equals,com.example.vu.android@2.10.5)': 20,
            },
          ],
        },
        match: [
          MockApiClient.matchQuery({referrer: 'api.insights.mobile-startup-totals'}),
        ],
      });

      render(<ScreenSummaryContentPage />, {
        initialRouterConfig,
        organization,
      });

      await waitFor(() => {
        expect(eventsMock).toHaveBeenCalled();
      });

      const blocks = [
        {header: 'Avg Cold Start', value: '1.00s'},
        {header: 'Count', value: '20'},
      ];

      for (const block of blocks) {
        const blockEl = screen.getByRole('heading', {name: block.header}).closest('div');
        await within(blockEl!).findByText(block.value);
      }
    });
  });
});
