import type {Location} from 'history';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import {render, screen, waitFor, within} from 'sentry-test/reactTestingLibrary';

import {useLocation} from 'sentry/utils/useLocation';
import usePageFilters from 'sentry/utils/usePageFilters';
import useCrossPlatformProject from 'sentry/views/insights/mobile/common/queries/useCrossPlatformProject';
import {MODULE_FEATURE} from 'sentry/views/insights/mobile/screens/settings';
import {ScreensLandingPage} from 'sentry/views/insights/mobile/screens/views/screensLandingPage';

jest.mock('sentry/utils/usePageFilters');
jest.mock('sentry/utils/useLocation');
jest.mock('sentry/views/insights/mobile/common/queries/useCrossPlatformProject');

describe('Screens Landing Page', function () {
  const organization = OrganizationFixture({
    features: [MODULE_FEATURE],
  });
  const project = ProjectFixture({platform: 'react-native'});

  jest.mocked(useLocation).mockReturnValue({
    action: 'PUSH',
    hash: '',
    key: '',
    pathname: '/organizations/org-slug/insights/mobile-screens',
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
    selectedPlatform: 'Android',
    isProjectCrossPlatform: true,
  });

  describe('Top Section', function () {
    beforeEach(() => {
      organization.features = [MODULE_FEATURE];
      MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/events-stats/`,
      });

      MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/events/`,
      });
    });

    afterEach(() => {
      MockApiClient.clearMockResponses();
      jest.clearAllMocks();
    });

    it('shows the platform selector for hybrid sdks', async function () {
      render(<ScreensLandingPage />, {organization});
      expect(await screen.findByLabelText('Android')).toBeInTheDocument();
    });

    it('renders all vital cards', async function () {
      jest.mocked(useLocation).mockReturnValue({
        action: 'PUSH',
        hash: '',
        key: '',
        pathname: '/organizations/org-slug/insights/mobile-screens',
        query: {
          project: project.id,
        },
        search: '',
        state: undefined,
      } as Location);

      const metricsMock = MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/events/`,
        body: {
          data: [
            {
              'avg(measurements.app_start_cold)': 1,
              'avg(measurements.app_start_warm)': 2,
              'avg(measurements.time_to_initial_display)': 3,
              'avg(measurements.time_to_full_display)': 4,
            },
          ],
          meta: {
            fields: {
              'avg(measurements.app_start_warm)': 'duration',
              'avg(measurements.time_to_full_display)': 'duration',
              'avg(measurements.time_to_initial_display)': 'duration',
              'avg(measurements.app_start_cold)': 'duration',
            },
            units: {
              'avg(measurements.app_start_warm)': 'millisecond',
              'avg(measurements.time_to_full_display)': 'millisecond',
              'avg(measurements.time_to_initial_display)': 'millisecond',
              'avg(measurements.app_start_cold)': 'millisecond',
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
              'avg(mobile.slow_frames)': 5,
              'avg(mobile.frozen_frames)': 6,
              'avg(mobile.frames_delay)': 7,
            },
          ],
          meta: {
            fields: {
              'avg(mobile.slow_frames)': 'number',
              'avg(mobile.frames_delay)': 'number',
              'avg(mobile.frozen_frames)': 'number',
            },
            units: {
              'avg(mobile.slow_frames)': null,
              'avg(mobile.frames_delay)': null,
              'avg(mobile.frozen_frames)': null,
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

      render(<ScreensLandingPage />, {organization});

      await waitFor(() => {
        expect(metricsMock).toHaveBeenCalled();
      });
      expect(spanMetricsMock).toHaveBeenCalled();

      const cards = [
        {header: 'Cold App Start', value: '1'},
        {header: 'Warm App Start', value: '2'},
        {header: 'TTID', value: '3'},
        {header: 'TTFD', value: '4'},
        {header: 'Slow Frames', value: '5'},
        {header: 'Frozen Frames', value: '6'},
        {header: 'Frame Delay', value: '7'},
      ];

      const topSection = screen.getByTestId('mobile-screens-top-metrics');

      for (const card of cards) {
        expect(within(topSection).getByText(card.header)).toBeInTheDocument();
      }
    });
  });
  describe('Permissions', function () {
    beforeEach(() => {
      MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/events-stats/`,
      });

      MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/events/`,
      });
    });

    afterEach(() => {
      MockApiClient.clearMockResponses();
    });

    it('shows no content if permission is missing', async function () {
      organization.features = [];
      render(<ScreensLandingPage />, {organization});
      expect(
        await screen.findByText("You don't have access to this feature")
      ).toBeInTheDocument();
    });

    it('shows content if permission is there', async function () {
      organization.features = [MODULE_FEATURE, 'insights-entry-points'];
      render(<ScreensLandingPage />, {organization});
      expect(await screen.findAllByText('Mobile Screens')).toHaveLength(2);
    });
  });
});
