import type {Location} from 'history';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import {render, screen, waitFor, within} from 'sentry-test/reactTestingLibrary';

import {useLocation} from 'sentry/utils/useLocation';
import usePageFilters from 'sentry/utils/usePageFilters';
import {ScreenSummary} from 'sentry/views/insights/mobile/appStarts/views/screenSummaryPage';
import {SpanMetricsField} from 'sentry/views/insights/types';

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
    let eventsMock: jest.Mock;

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
      jest.mocked(useLocation).mockReturnValue({
        action: 'PUSH',
        hash: '',
        key: '',
        pathname: '/organizations/org-slug/insights/screens/spans/',
        query: {
          project: project.id,
          transaction: 'MainActivity',
          primaryRelease: 'com.example.vu.android@2.10.5',
          secondaryRelease: 'com.example.vu.android@2.10.3+42',
          [SpanMetricsField.APP_START_TYPE]: 'cold',
        },
        search: '',
        state: undefined,
      } as Location);
      eventsMock = MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/events/`,
        body: {
          data: [
            {
              'span.op': 'app.start.cold',
              'avg_if(span.duration,release,com.example.vu.android@2.10.5)': 1000,
              'avg_if(span.duration,release,com.example.vu.android@2.10.3+42)': 2000,
              'avg_compare(span.duration,release,com.example.vu.android@2.10.5,com.example.vu.android@2.10.3+42)':
                -0.5,
              'count_if(release,com.example.vu.android@2.10.5)': 20,
              'count_if(release,com.example.vu.android@2.10.3+42)': 10,
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
        {header: 'Avg Cold Start (R1)', value: '1.00s'},
        {header: 'Avg Cold Start (R2)', value: '2.00s'},
        {header: 'Change', value: '-50%'},
        {header: 'Count (R1)', value: '20'},
        {header: 'Count (R2)', value: '10'},
      ];

      for (const block of blocks) {
        const blockEl = screen.getByRole('heading', {name: block.header}).closest('div');
        await within(blockEl!).findByText(block.value);
      }

      expect(screen.getByText('-50%')).toHaveAttribute('data-rating', 'good');
    });
  });
});
