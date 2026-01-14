import {UptimeDetectorFixture} from 'sentry-fixture/detectors';
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
import UptimeDetectorsList from 'sentry/views/detectors/list/uptime';

// Mock the service incidents component to verify it's NOT rendered
jest.mock('sentry/views/insights/crons/components/serviceIncidents', () => ({
  CronServiceIncidents: () => <div data-test-id="cron-service-incidents" />,
}));

describe('UptimeDetectorsList', () => {
  const organization = OrganizationFixture({
    features: ['workflow-engine-ui'],
  });

  const initialRouterConfig: RouterConfig = {
    location: {
      pathname: `/organizations/${organization.slug}/detectors/uptime/`,
    },
  };

  beforeEach(() => {
    MockApiClient.clearMockResponses();
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/users/1/',
      body: UserFixture(),
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
  });

  it('displays header when no uptime monitors are found', async () => {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/detectors/',
      body: [],
    });

    render(<UptimeDetectorsList />, {organization, initialRouterConfig});

    // Page heading/title
    expect(await screen.findByText('Uptime Monitors')).toBeInTheDocument();
    // No rows present
    expect(screen.queryByTestId('detector-list-row')).not.toBeInTheDocument();
  });

  it('loads uptime monitors, renders timeline, and updates on time selection', async () => {
    // Detectors list returns a single uptime monitor
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/detectors/',
      body: [UptimeDetectorFixture({name: 'Uptime Detector', id: 'uptime-1'})],
    });

    // Monitor stats for the uptime detector id "uptime-1"
    const nowSec = Math.floor(Date.now() / 1000);
    const monitorStatsRequest = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/uptime-stats/',
      body: {
        'uptime-1': [
          [
            nowSec - 3600,
            {
              success: 1,
              failure: 0,
              failure_incident: 0,
              missed_window: 0,
            },
          ],
        ],
      },
    });

    const {router} = render(<UptimeDetectorsList />, {organization, initialRouterConfig});

    // Page header/title and detector row
    expect(await screen.findByText('Uptime Monitors')).toBeInTheDocument();
    const row = await screen.findByTestId('detector-list-row');
    expect(row).toBeInTheDocument();

    expect(screen.getByRole('columnheader', {name: /Name/})).toBeInTheDocument();
    expect(screen.getByRole('columnheader', {name: 'Last Issue'})).toBeInTheDocument();
    expect(screen.getByRole('columnheader', {name: 'Assignee'})).toBeInTheDocument();
    expect(screen.getByRole('columnheader', {name: 'Alerts'})).toBeInTheDocument();

    // Name
    expect(within(row).getByText('Uptime Detector')).toBeInTheDocument();

    // Should NOT render service incidents overlay
    expect(screen.queryByTestId('cron-service-incidents')).not.toBeInTheDocument();

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
