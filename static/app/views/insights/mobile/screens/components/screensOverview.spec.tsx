import type {Location} from 'history';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {PageFilterStateFixture} from 'sentry-fixture/pageFilters';
import {ProjectFixture} from 'sentry-fixture/project';

import {render, screen, waitFor} from 'sentry-test/reactTestingLibrary';

import {useLocation} from 'sentry/utils/useLocation';
import usePageFilters from 'sentry/utils/usePageFilters';
import useCrossPlatformProject from 'sentry/views/insights/mobile/common/queries/useCrossPlatformProject';
import {ScreensOverview} from 'sentry/views/insights/mobile/screens/components/screensOverview';

jest.mock('sentry/views/insights/mobile/common/queries/useCrossPlatformProject');
jest.mock('sentry/utils/usePageFilters');
jest.mock('sentry/utils/useLocation');

describe('ScreensOverview', () => {
  const organization = OrganizationFixture({
    features: ['insight-modules'],
  });
  const project = ProjectFixture();

  jest.mocked(useLocation).mockReturnValue({
    action: 'PUSH',
    hash: '',
    key: '',
    pathname: '/organizations/org-slug/performance/mobile/mobile-vitals',
    query: {
      project: project.id,
    },
    search: '',
    state: undefined,
  } as Location);

  jest.mocked(usePageFilters).mockReturnValue(
    PageFilterStateFixture({
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
    })
  );

  jest.mocked(useCrossPlatformProject).mockReturnValue({
    project,
    isProjectCrossPlatform: true,
    selectedPlatform: 'Android',
  });

  it('renders search bar and table', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events/`,
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/releases/`,
      body: [],
    });
    render(<ScreensOverview />, {organization});

    expect(await screen.findByPlaceholderText('Search for Screen')).toBeInTheDocument();
    expect(await screen.findByRole('table')).toBeInTheDocument();
  });

  it('queries correctly', async () => {
    const metricsMock = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events/`,
      body: {
        data: [
          {
            transaction: 'Screen A',
            'project.id': project.id,
            'avg(measurements.time_to_full_display)': 100,
            'avg(measurements.time_to_initial_display)': 200,
            'count()': 10000,
            'avg(measurements.app_start_cold)': 300,
            'avg(measurements.app_start_warm)': 400,
            'avg(mobile.frozen_frames)': 1,
            'avg(mobile.frames_delay)': 2,
            'avg(mobile.slow_frames)': 3,
          },
          {
            transaction: 'Screen B',
            'project.id': project.id,
            'avg(measurements.time_to_full_display)': 5,
            'avg(measurements.time_to_initial_display)': 600,
            'count()': 5000,
            'avg(measurements.app_start_cold)': 700,
            'avg(measurements.app_start_warm)': 800,
            'avg(mobile.frozen_frames)': 4,
            'avg(mobile.frames_delay)': 5,
            'avg(mobile.slow_frames)': 6,
          },
        ],
        meta: {
          fields: {
            transaction: 'string',
            'project.id': 'integer',
            'avg(measurements.time_to_full_display)': 'duration',
            'avg(measurements.time_to_initial_display)': 'duration',
            'count()': 'integer',
            'avg(measurements.app_start_cold)': 'duration',
            'avg(measurements.app_start_warm)': 'duration',
            'avg(mobile.frozen_frames)': 'number',
            'avg(mobile.frames_delay)': 'number',
            'avg(mobile.slow_frames)': 'number',
          },
          units: {
            transaction: null,
            'project.id': null,
            'avg(measurements.time_to_full_display)': 'millisecond',
            'avg(measurements.time_to_initial_display)': 'millisecond',
            'count()': null,
            'avg(measurements.app_start_cold)': 'millisecond',
            'avg(measurements.app_start_warm)': 'millisecond',
            'avg(mobile.frozen_frames)': null,
            'avg(mobile.frames_delay)': null,
            'avg(mobile.slow_frames)': null,
          },
          isMetricsData: true,
          isMetricsExtractedData: false,
          tips: {},
          datasetReason: 'unchanged',
          dataset: 'spans',
        },
      },
      match: [
        MockApiClient.matchQuery({
          referrer: 'api.insights.mobile-screens-screen-table-span-metrics',
        }),
      ],
    });

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/releases/`,
      body: [],
    });

    render(<ScreensOverview />, {organization});

    await waitFor(() => {
      expect(metricsMock).toHaveBeenCalled();
    });
  });
});
