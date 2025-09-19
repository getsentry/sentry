import {OrganizationFixture} from 'sentry-fixture/organization';
import {PageFilterStateFixture} from 'sentry-fixture/pageFilters';
import {ProjectFixture} from 'sentry-fixture/project';
import {TimeSeriesFixture} from 'sentry-fixture/timeSeries';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import ProjectsStore from 'sentry/stores/projectsStore';
import {useLocation} from 'sentry/utils/useLocation';
import usePageFilters from 'sentry/utils/usePageFilters';
import {useReleaseStats} from 'sentry/utils/useReleaseStats';
import QueuesLandingPage from 'sentry/views/insights/queues/views/queuesLandingPage';

jest.mock('sentry/utils/useLocation');
jest.mock('sentry/utils/usePageFilters');
jest.mock('sentry/utils/useReleaseStats');

describe('queuesLandingPage', () => {
  const organization = OrganizationFixture({
    features: ['insight-modules'],
  });
  const project = ProjectFixture();
  project.firstTransactionEvent = true;
  project.hasInsightsQueues = true;

  jest.mocked(usePageFilters).mockReturnValue(PageFilterStateFixture());

  jest.mocked(useLocation).mockReturnValue({
    pathname: '',
    search: '',
    query: {statsPeriod: '10d', project: '1'},
    hash: '',
    state: undefined,
    action: 'PUSH',
    key: '',
  });

  jest.mocked(useReleaseStats).mockReturnValue({
    isLoading: false,
    isPending: false,
    isError: false,
    error: null,
    releases: [],
  });

  let eventsMock: jest.Mock;
  let eventsStatsMock: jest.Mock;

  beforeEach(() => {
    ProjectsStore.loadInitialData([project]);
    eventsMock = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events/`,
      method: 'GET',
      body: {data: [{'count()': 1}]},
    });

    eventsStatsMock = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events-timeseries/`,
      method: 'GET',
      body: {
        timeSeries: [
          TimeSeriesFixture({
            yAxis: 'epm()',
            values: [{value: 1, timestamp: 1739378162000}],
          }),
        ],
      },
    });

    // Mock for unchanged throughput chart that still uses events-stats
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events-stats/`,
      method: 'GET',
      body: {data: []},
    });
  });

  it('renders', async () => {
    render(<QueuesLandingPage />, {organization, deprecatedRouterMocks: true});
    await screen.findByRole('table', {name: 'Queues'});
    screen.getByPlaceholderText('Search for more destinations');
    screen.getByText('Average Duration');
    screen.getByText('Published vs Processed');
    expect(eventsStatsMock).toHaveBeenCalled();
    expect(eventsMock).toHaveBeenCalled();
  });
});
