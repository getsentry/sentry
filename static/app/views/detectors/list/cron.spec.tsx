import {CronDetectorFixture} from 'sentry-fixture/detectors';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {PageFiltersFixture} from 'sentry-fixture/pageFilters';
import {UserFixture} from 'sentry-fixture/user';

import {
  render,
  screen,
  userEvent,
  waitFor,
  within,
  type RouterConfig,
} from 'sentry-test/reactTestingLibrary';

import PageFiltersStore from 'sentry/stores/pageFiltersStore';
import * as useServiceIncidentsModule from 'sentry/utils/useServiceIncidents';
import CronDetectorsList from 'sentry/views/detectors/list/cron';

jest.mock('sentry/utils/useServiceIncidents');

describe('CronDetectorsList', () => {
  const organization = OrganizationFixture({
    features: ['workflow-engine-ui'],
  });

  const initialRouterConfig: RouterConfig = {
    location: {
      pathname: `/organizations/${organization.slug}/detectors/crons/`,
    },
  };

  beforeEach(() => {
    MockApiClient.clearMockResponses();
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/users/1/',
      body: UserFixture(),
    });

    // Mock processing errors endpoint (no errors by default)
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/processing-errors/',
      body: [],
    });

    // Ensure a project is selected for queries
    PageFiltersStore.onInitializeUrlState(PageFiltersFixture({projects: [1]}));

    // Make elements report a non-zero size so timelines compute rollups and fetch
    Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
      configurable: true,
      get() {
        return 800;
      },
    });
    Object.defineProperty(HTMLElement.prototype, 'clientHeight', {
      configurable: true,
      get() {
        return 50;
      },
    });

    jest.mocked(useServiceIncidentsModule.useServiceIncidents).mockReturnValue({
      data: null,
      isLoading: false,
      isError: false,
      refetch: jest.fn(),
    } as any);
  });

  it('displays empty state when no cron monitors are found', async () => {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/detectors/',
      body: [],
    });

    render(<CronDetectorsList />, {organization, initialRouterConfig});

    // Should show text for onboarding state
    expect(await screen.findByText('Monitor Your Cron Jobs')).toBeInTheDocument();
    expect(
      screen.getByText(
        "We'll tell you if your recurring jobs are running on schedule, failing, or succeeding."
      )
    ).toBeInTheDocument();

    // Check that platform buttons exist
    expect(screen.getByLabelText('Create python Monitor')).toBeInTheDocument();
    expect(screen.getByLabelText('Create php Monitor')).toBeInTheDocument();
    expect(screen.getByLabelText('Create node Monitor')).toBeInTheDocument();

    // Check for the special buttons (LinkButton renders as role="button" with aria-label)
    expect(screen.getByRole('button', {name: 'Sentry CLI'})).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'HTTP (cURL)'})).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Manual Setup'})).toBeInTheDocument();
  });

  it('loads cron monitors, renders timeline, and updates on time selection', async () => {
    // Detectors list returns a single cron monitor
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/detectors/',
      body: [CronDetectorFixture({name: 'Cron Detector'})],
    });

    // Monitor stats for the cron monitor id "uuid-foo"
    const nowSec = Math.floor(Date.now() / 1000);
    const monitorStatsRequest = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/monitors-stats/',
      body: {
        'uuid-foo': [
          [
            nowSec - 3600,
            {
              production: {
                ok: 1,
                error: 0,
                missed: 0,
                timeout: 0,
                in_progress: 0,
                unknown: 0,
              },
            },
          ],
        ],
      },
    });

    jest.mocked(useServiceIncidentsModule.useServiceIncidents).mockReturnValue({
      data: [
        {
          id: 'incident-1',
          name: 'Incident',
          status: 'investigating',
          created_at: new Date(nowSec * 1000 - 3600 * 1000).toISOString(),
          started_at: new Date(nowSec * 1000 - 3600 * 1000).toISOString(),
          updated_at: new Date(nowSec * 1000).toISOString(),
          shortlink: 'http://example.com',
          components: [],
          incident_updates: [],
        } as any,
      ],
      isLoading: false,
      isError: false,
      refetch: jest.fn(),
    } as any);

    const {router} = render(<CronDetectorsList />, {organization, initialRouterConfig});

    // Page header/title and detector row
    expect(await screen.findByText('Cron Monitors')).toBeInTheDocument();
    const row = await screen.findByTestId('detector-list-row');
    expect(row).toBeInTheDocument();

    expect(screen.getByRole('columnheader', {name: /Name/})).toBeInTheDocument();
    expect(screen.getByRole('columnheader', {name: 'Last Issue'})).toBeInTheDocument();
    expect(screen.getByRole('columnheader', {name: 'Assignee'})).toBeInTheDocument();
    expect(screen.getByRole('columnheader', {name: 'Alerts'})).toBeInTheDocument();

    // Name
    expect(within(row).getByText('Cron Detector')).toBeInTheDocument();

    // Environment name
    expect(within(row).getByText('production')).toBeInTheDocument();

    // Should render service incidents overlay
    expect(
      await screen.findByTestId('cron-service-incident-indicator')
    ).toBeInTheDocument();

    // Timeline visualization should render ticks once stats load
    expect(await screen.findAllByTestId('monitor-checkin-tick')).not.toHaveLength(0);
    expect(monitorStatsRequest).toHaveBeenCalled();

    // Time range selector should be present
    const timeTrigger = screen.getByTestId('page-filter-timerange-selector');
    await userEvent.click(timeTrigger);
    await userEvent.click(await screen.findByRole('option', {name: 'Last hour'}));

    // Should update the stats period to 1h
    await waitFor(() => {
      expect(router.location.query.statsPeriod).toBe('1h');
    });

    // Updating stats period should cause the monitor stats request to refetch
    expect(monitorStatsRequest).toHaveBeenCalledTimes(2);
  });
});
