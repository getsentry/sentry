import {Location} from 'history';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import {render, screen, waitFor, within} from 'sentry-test/reactTestingLibrary';

import {useLocation} from 'sentry/utils/useLocation';
import usePageFilters from 'sentry/utils/usePageFilters';
import ScreenSummary from 'sentry/views/starfish/views/appStartup/screenSummary';

jest.mock('sentry/utils/usePageFilters');
jest.mock('sentry/utils/useLocation');

describe('Screen Summary', function () {
  const organization = OrganizationFixture();
  const project = ProjectFixture();

  jest.mocked(useLocation).mockReturnValue({
    action: 'PUSH',
    hash: '',
    key: '',
    pathname: '/organizations/org-slug/performance/mobile/screens/spans/',
    query: {
      project: project.id,
      transaction: 'MainActivity',
      primaryRelease: 'com.example.vu.android@2.10.5',
      secondaryRelease: 'com.example.vu.android@2.10.3+42',
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

  describe('Native Project', function () {
    let eventsMock;

    beforeEach(() => {
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
        url: `/organizations/${organization.slug}/events-stats/`,
      });
      eventsMock = MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/events/`,
      });
    });

    afterEach(() => {
      MockApiClient.clearMockResponses();
      jest.clearAllMocks();
    });

    it('renders the top level metrics data correctly', async function () {
      eventsMock = MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/events/`,
        body: {
          data: [
            {
              'span.op': 'app.start.cold',
              'avg_if(span.duration,release,com.example.vu.android@2.10.5)': 1000,
              'avg_if(span.duration,release,com.example.vu.android@2.10.3+42)': 2000,
              'count()': 20,
            },
            {
              'span.op': 'app.start.warm',
              'avg_if(span.duration,release,com.example.vu.android@2.10.5)': 5000,
              'avg_if(span.duration,release,com.example.vu.android@2.10.3+42)': 6000,
              'count()': 30,
            },
          ],
        },
        match: [
          MockApiClient.matchQuery({referrer: 'api.starfish.mobile-startup-totals'}),
        ],
      });

      render(<ScreenSummary />, {organization});

      await waitFor(() => {
        expect(eventsMock).toHaveBeenCalled();
      });

      const blocks = [
        {header: 'Cold Start (2.10.5)', value: '1.00s'},
        {header: 'Cold Start (2.10.… (42))', value: '2.00s'},
        {header: 'Warm Start (2.10.5)', value: '5.00s'},
        {header: 'Warm Start (2.10.… (42))', value: '6.00s'},
        {header: 'Count', value: '50'},
      ];

      for (const block of blocks) {
        const blockEl = screen.getByRole('heading', {name: block.header}).closest('div');
        await within(blockEl!).findByText(block.value);
      }
    });
  });
});
