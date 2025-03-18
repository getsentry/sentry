import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import {useLocation} from 'sentry/utils/useLocation';
import usePageFilters from 'sentry/utils/usePageFilters';
import useProjects from 'sentry/utils/useProjects';
import {useReleaseStats} from 'sentry/utils/useReleaseStats';
import QueuesLandingPage from 'sentry/views/insights/queues/views/queuesLandingPage';

vi.mock('sentry/utils/useLocation');
vi.mock('sentry/utils/usePageFilters');
vi.mock('sentry/utils/useProjects');
vi.mock('sentry/utils/useReleaseStats');

describe('queuesLandingPage', () => {
  const organization = OrganizationFixture({
    features: ['insights-addon-modules'],
  });
  const project = ProjectFixture();
  project.firstTransactionEvent = true;
  project.hasInsightsQueues = true;

  vi.mocked(usePageFilters).mockReturnValue({
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
      projects: [],
    },
  });

  vi.mocked(useLocation).mockReturnValue({
    pathname: '',
    search: '',
    query: {statsPeriod: '10d', project: '1'},
    hash: '',
    state: undefined,
    action: 'PUSH',
    key: '',
  });

  vi.mocked(useProjects).mockReturnValue({
    projects: [project],
    onSearch: vi.fn(),
    reloadProjects: vi.fn(),
    placeholders: [],
    fetching: false,
    hasMore: null,
    fetchError: null,
    initiallyLoaded: false,
  });

  vi.mocked(useReleaseStats).mockReturnValue({
    isLoading: false,
    isPending: false,
    isError: false,
    error: null,
    releases: [],
  });

  let eventsMock: vi.Mock;
  let eventsStatsMock: vi.Mock;

  beforeEach(() => {
    eventsMock = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events/`,
      method: 'GET',
      body: {data: [{'count()': 1}]},
    });

    eventsStatsMock = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events-stats/`,
      method: 'GET',
      body: {data: []},
    });
  });

  it('renders', async () => {
    render(<QueuesLandingPage />, {organization});
    await screen.findByRole('table', {name: 'Queues'});
    screen.getByPlaceholderText('Search for more destinations');
    screen.getByText('Average Duration');
    screen.getByText('Published vs Processed');
    expect(eventsStatsMock).toHaveBeenCalled();
    expect(eventsMock).toHaveBeenCalled();
  });
});
