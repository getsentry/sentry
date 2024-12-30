import type {Location} from 'history';
import {OrganizationFixture} from 'sentry-fixture/organization';
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
    features: ['insights-addon-modules'],
  });
  const project = ProjectFixture();

  jest.mocked(useLocation).mockReturnValue({
    action: 'PUSH',
    hash: '',
    key: '',
    pathname: '/organizations/org-slug/performance/mobile/mobile-screens',
    query: {
      project: project.id,
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

  jest.mocked(useCrossPlatformProject).mockReturnValue({
    project,
    isProjectCrossPlatform: true,
    selectedPlatform: 'Android',
  });

  it('renders search bar and table', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events/`,
    });
    render(<ScreensOverview />, {organization});

    expect(await screen.findByPlaceholderText('Search for Screen')).toBeInTheDocument();
    expect(await screen.findByRole('table')).toBeInTheDocument();
  });

  it('queries both dataset correctly', async () => {
    const transactionMetricsMock = MockApiClient.addMockResponse({
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
          },
          {
            transaction: 'Screen B',
            'project.id': project.id,
            'avg(measurements.time_to_full_display)': 5,
            'avg(measurements.time_to_initial_display)': 600,
            'count()': 5000,
            'avg(measurements.app_start_cold)': 700,
            'avg(measurements.app_start_warm)': 800,
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
          },
          units: {
            transaction: null,
            'project.id': null,
            'avg(measurements.time_to_full_display)': 'millisecond',
            'avg(measurements.time_to_initial_display)': 'millisecond',
            'count()': null,
            'avg(measurements.app_start_cold)': 'millisecond',
            'avg(measurements.app_start_warm)': 'millisecond',
          },
          isMetricsData: true,
          isMetricsExtractedData: false,
          tips: {},
          datasetReason: 'unchanged',
          dataset: 'metrics',
        },
      },
      match: [MockApiClient.matchQuery({dataset: 'metrics'})],
    });

    const spanMetricsMock = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events/`,
      body: {
        data: [
          {
            'project.id': project.id,
            transaction: 'Screen A',
            'avg(mobile.frozen_frames)': 1,
            'avg(mobile.frames_delay)': 2,
            'avg(mobile.slow_frames)': 3,
          },
          {
            'project.id': project.id,
            transaction: 'Screen B',
            'avg(mobile.frozen_frames)': 4,
            'avg(mobile.frames_delay)': 5,
            'avg(mobile.slow_frames)': 6,
          },
        ],
        meta: {
          fields: {
            'project.id': 'integer',
            transaction: 'string',
            'avg(mobile.frozen_frames)': 'number',
            'avg(mobile.frames_delay)': 'number',
            'avg(mobile.slow_frames)': 'number',
          },
          units: {
            'project.id': null,
            transaction: null,
            'avg(mobile.frozen_frames)': null,
            'avg(mobile.frames_delay)': null,
            'avg(mobile.slow_frames)': null,
          },
          isMetricsData: false,
          isMetricsExtractedData: false,
          tips: {},
          datasetReason: 'unchanged',
          dataset: 'spansMetrics',
        },
      },
      match: [MockApiClient.matchQuery({dataset: 'spansMetrics'})],
    });

    render(<ScreensOverview />, {organization});
    await waitFor(() => {
      expect(transactionMetricsMock).toHaveBeenCalled();
      expect(spanMetricsMock).toHaveBeenCalled();
    });
  });
});
