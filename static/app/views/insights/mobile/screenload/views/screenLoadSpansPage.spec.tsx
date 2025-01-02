import type {Location} from 'history';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import {render, screen, waitFor, within} from 'sentry-test/reactTestingLibrary';

import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import localStorage from 'sentry/utils/localStorage';
import {useLocation} from 'sentry/utils/useLocation';
import usePageFilters from 'sentry/utils/usePageFilters';
import useProjects from 'sentry/utils/useProjects';
import {useOnboardingProject} from 'sentry/views/insights/common/queries/useOnboardingProject';
import ScreenLoadSpans from 'sentry/views/insights/mobile/screenload/views/screenLoadSpansPage';

jest.mock('sentry/views/insights/common/queries/useOnboardingProject');
jest.mock('sentry/utils/useLocation');
jest.mock('sentry/utils/usePageFilters');
jest.mock('sentry/utils/useProjects');

function mockResponses(organization: Organization, project: Project) {
  jest.mocked(useOnboardingProject).mockReturnValue(undefined);

  jest.mocked(useProjects).mockReturnValue({
    fetchError: null,
    fetching: false,
    hasMore: false,
    initiallyLoaded: false,
    onSearch: jest.fn(),
    reloadProjects: jest.fn(),
    placeholders: [],
    projects: [project],
  });

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
  MockApiClient.addMockResponse({
    url: `/organizations/${organization.slug}/events/`,
    query: {
      dataset: 'metrics',
      environment: [],
      field: ['release', 'count()'],
      per_page: 50,
      project: ['2'],
      query:
        'transaction.op:ui.load release:["com.example.vu.android@2.10.5","com.example.vu.android@2.10.3+42"]',
      referrer: 'api.starfish.mobile-release-selector',
      statsPeriod: '10d',
    },
    body: {
      meta: {},
      data: [
        {
          release: 'com.example.vu.android@2.10.5',
          'count()': 9768,
        },
        {
          release: 'com.example.vu.android@2.10.3+42',
          'count()': 826,
        },
      ],
    },
  });
}

describe('Screen Summary', function () {
  describe('Cross Platform Project', function () {
    let eventsMock: jest.Mock;
    let eventsStatsMock: jest.Mock;
    let organization: Organization;
    beforeEach(function () {
      const project = ProjectFixture({
        platform: 'react-native',
        hasInsightsScreenLoad: true,
      });
      organization = OrganizationFixture({
        features: ['insights-initial-modules', 'insights-entry-points'],
      });
      mockResponses(organization, project);
      localStorage.clear();
      eventsMock = MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/events/`,
      });
      eventsStatsMock = MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/events-stats/`,
      });
    });

    afterEach(function () {
      MockApiClient.clearMockResponses();
      jest.clearAllMocks();
    });

    it('appends os.name filter for react native projects', async function () {
      render(<ScreenLoadSpans />, {organization});
      // Event samples
      await waitFor(() => {
        expect(eventsMock).toHaveBeenCalledWith(
          expect.anything(),
          expect.objectContaining({
            query: expect.objectContaining({
              dataset: 'discover',
              query:
                'transaction.op:ui.load transaction:MainActivity release:com.example.vu.android@2.10.5 os.name:Android',
            }),
          })
        );
      });
      await waitFor(() => {
        expect(eventsMock).toHaveBeenCalledWith(
          expect.anything(),
          expect.objectContaining({
            query: expect.objectContaining({
              dataset: 'discover',
              query:
                'transaction.op:ui.load transaction:MainActivity release:com.example.vu.android@2.10.3+42 os.name:Android',
            }),
          })
        );
      });

      // Span Table
      await waitFor(() => {
        expect(eventsMock).toHaveBeenCalledWith(
          expect.anything(),
          expect.objectContaining({
            query: expect.objectContaining({
              dataset: 'spansMetrics',
              query:
                'transaction.op:ui.load transaction:MainActivity has:span.description span.op:[file.read,file.write,ui.load,http.client,db,db.sql.room,db.sql.query,db.sql.transaction] os.name:Android ( release:com.example.vu.android@2.10.5 OR release:com.example.vu.android@2.10.3+42 )',
            }),
          })
        );
      });

      // Chart
      await waitFor(() => {
        expect(eventsMock).toHaveBeenCalledWith(
          expect.anything(),
          expect.objectContaining({
            query: expect.objectContaining({
              dataset: 'metrics',
              query:
                'event.type:transaction transaction.op:ui.load transaction:MainActivity os.name:Android ( release:com.example.vu.android@2.10.5 OR release:com.example.vu.android@2.10.3+42 )',
            }),
          })
        );
      });
      await waitFor(() => {
        expect(eventsStatsMock).toHaveBeenCalledWith(
          expect.anything(),
          expect.objectContaining({
            query: expect.objectContaining({
              dataset: 'metrics',
              query:
                'event.type:transaction transaction.op:ui.load transaction:MainActivity os.name:Android ( release:com.example.vu.android@2.10.5 OR release:com.example.vu.android@2.10.3+42 )',
            }),
          })
        );
      });
    });
  });

  describe('Native Project', function () {
    let eventsMock: jest.Mock;
    let eventsStatsMock: jest.Mock;
    let organization: Organization;
    beforeEach(function () {
      const project = ProjectFixture({platform: 'android', hasInsightsScreenLoad: true});
      organization = OrganizationFixture({
        features: ['insights-initial-modules', 'insights-entry-points'],
      });
      mockResponses(organization, project);
      localStorage.clear();
      eventsMock = MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/events/`,
      });
      eventsStatsMock = MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/events-stats/`,
      });
    });

    afterEach(function () {
      MockApiClient.clearMockResponses();
      jest.clearAllMocks();
    });

    it('does not append os.name filter for native projects', async function () {
      render(<ScreenLoadSpans />, {organization});
      // Event samples
      await waitFor(() => {
        expect(eventsMock).toHaveBeenCalledWith(
          expect.anything(),
          expect.objectContaining({
            query: expect.objectContaining({
              dataset: 'discover',
              query:
                'transaction.op:ui.load transaction:MainActivity release:com.example.vu.android@2.10.5',
            }),
          })
        );
      });
      await waitFor(() => {
        expect(eventsMock).toHaveBeenCalledWith(
          expect.anything(),
          expect.objectContaining({
            query: expect.objectContaining({
              dataset: 'discover',
              query:
                'transaction.op:ui.load transaction:MainActivity release:com.example.vu.android@2.10.3+42',
            }),
          })
        );
      });

      // Span Table
      await waitFor(() => {
        expect(eventsMock).toHaveBeenCalledWith(
          expect.anything(),
          expect.objectContaining({
            query: expect.objectContaining({
              dataset: 'spansMetrics',
              query:
                'transaction.op:ui.load transaction:MainActivity has:span.description span.op:[file.read,file.write,ui.load,http.client,db,db.sql.room,db.sql.query,db.sql.transaction] ( release:com.example.vu.android@2.10.5 OR release:com.example.vu.android@2.10.3+42 )',
            }),
          })
        );
      });

      // Chart
      await waitFor(() => {
        expect(eventsMock).toHaveBeenCalledWith(
          expect.anything(),
          expect.objectContaining({
            query: expect.objectContaining({
              dataset: 'metrics',
              query:
                'event.type:transaction transaction.op:ui.load transaction:MainActivity ( release:com.example.vu.android@2.10.5 OR release:com.example.vu.android@2.10.3+42 )',
            }),
          })
        );
      });

      await waitFor(() => {
        expect(eventsStatsMock).toHaveBeenCalledWith(
          expect.anything(),
          expect.objectContaining({
            query: expect.objectContaining({
              dataset: 'metrics',
              query:
                'event.type:transaction transaction.op:ui.load transaction:MainActivity ( release:com.example.vu.android@2.10.5 OR release:com.example.vu.android@2.10.3+42 )',
            }),
          })
        );
      });
    });

    it('renders the top level metrics data correctly', async function () {
      eventsMock = MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/events/`,
        body: {
          data: [
            {
              'avg_if(measurements.time_to_initial_display,release,com.example.vu.android@2.10.5)': 1000,
              'avg_if(measurements.time_to_initial_display,release,com.example.vu.android@2.10.3+42)': 2000,
              'avg_if(measurements.time_to_full_display,release,com.example.vu.android@2.10.5)': 3000,
              'avg_if(measurements.time_to_full_display,release,com.example.vu.android@2.10.3+42)': 4000,
              'count_if(measurements.time_to_initial_display,release,com.example.vu.android@2.10.5)': 20,
              'count_if(measurements.time_to_initial_display,release,com.example.vu.android@2.10.3+42)': 10,
            },
          ],
        },
        match: [
          MockApiClient.matchQuery({referrer: 'api.starfish.mobile-screen-totals'}),
        ],
      });

      render(<ScreenLoadSpans />, {organization});

      await waitFor(() => {
        expect(eventsMock).toHaveBeenCalled();
      });

      const blocks = [
        {header: 'Avg TTID (R1)', value: '1.00s'},
        {header: 'Avg TTID (R2)', value: '2.00s'},
        {header: 'Avg TTFD (R1)', value: '3.00s'},
        {header: 'Avg TTFD (R2)', value: '4.00s'},
        {header: 'Total Count (R1)', value: '20'},
        {header: 'Total Count (R2)', value: '10'},
      ];

      for (const block of blocks) {
        const blockEl = screen.getByRole('heading', {name: block.header}).closest('div');
        await within(blockEl!).findByText(block.value);
      }
    });
  });
});
