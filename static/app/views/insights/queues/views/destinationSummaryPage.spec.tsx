import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen, waitForElementToBeRemoved} from 'sentry-test/reactTestingLibrary';

import {useLocation} from 'sentry/utils/useLocation';
import usePageFilters from 'sentry/utils/usePageFilters';
import useProjects from 'sentry/utils/useProjects';
import {useReleaseStats} from 'sentry/utils/useReleaseStats';
import PageWithProviders from 'sentry/views/insights/queues/views/destinationSummaryPage';

vi.mock('sentry/utils/useLocation');
vi.mock('sentry/utils/usePageFilters');
vi.mock('sentry/utils/useProjects');
vi.mock('sentry/utils/useReleaseStats');

describe('destinationSummaryPage', () => {
  const organization = OrganizationFixture({
    features: ['insights-addon-modules'],
  });

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
    projects: [],
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
      body: {data: []},
    });

    eventsStatsMock = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events-stats/`,
      method: 'GET',
      body: {
        data: [[1699907700, [{count: 0.2}]]],
        meta: {
          fields: {'avg(span.duration)': 'duration'},
          units: {
            'avg(span.duration)': 'millisecond',
          },
        },
      },
    });
  });

  it('renders', async () => {
    render(<PageWithProviders />, {organization});
    await screen.findByRole('table', {name: 'Transactions'});
    await waitForElementToBeRemoved(() => screen.queryAllByTestId('loading-indicator'));
    screen.getByText('Average Duration');
    screen.getByText('Published vs Processed');
    expect(eventsStatsMock).toHaveBeenCalled();
    expect(eventsMock).toHaveBeenCalled();
  });
});
