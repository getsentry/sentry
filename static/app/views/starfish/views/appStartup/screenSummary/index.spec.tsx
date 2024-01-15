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

  describe('Native Project', function () {
    it('renders the top level metrics data correctly', async function () {
      const eventsMock = MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/events/`,
        body: {
          data: [
            {
              'avg_if(duration,release,com.example.vu.android@2.10.5)': 1000,
              'avg_if(duration,release,com.example.vu.android@2.10.3+42)': 2000,
              'avg_if(duration,release,com.example.vu.android@2.10.5)': 3000,
              'avg_if(duration,release,com.example.vu.android@2.10.3+42)': 4000,
              'count()': 20,
            },
          ],
        },
        match: [
          MockApiClient.matchQuery({referrer: 'api.starfish.mobile-startup-totals'}),
        ],
      });
      MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/events/`,
      });

      render(<ScreenSummary />, {organization});

      await waitFor(() => {
        expect(eventsMock).toHaveBeenCalled();
      });

      const blocks = [
        {header: 'Cold Start (2.10.5)', value: '1.00s'},
        {header: 'Cold Start (2.10.… (42))', value: '2.00s'},
        {header: 'Warm Start (2.10.5)', value: '3.00s'},
        {header: 'Warm Start (2.10.… (42))', value: '4.00s'},
        {header: 'Count', value: '20'},
      ];

      // Wait for the ribbon request to finish
      await screen.findByText('1.00s');

      for (const block of blocks) {
        const blockEl = screen.getByRole('heading', {name: block.header}).closest('div');
        await waitFor(() => {
          within(blockEl!).getByText(block.value);
        });
      }
    });
  });
});
