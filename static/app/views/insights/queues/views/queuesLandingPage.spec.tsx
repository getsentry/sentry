import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';
import {TimeSeriesFixture} from 'sentry-fixture/timeSeries';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import ProjectsStore from 'sentry/stores/projectsStore';
import {useReleaseStats} from 'sentry/utils/useReleaseStats';
import QueuesLandingPage from 'sentry/views/insights/queues/views/queuesLandingPage';

jest.mock('sentry/utils/useReleaseStats');

describe('queuesLandingPage', () => {
  const organization = OrganizationFixture({
    features: ['insight-modules'],
  });
  const project = ProjectFixture();
  project.firstTransactionEvent = true;
  project.hasInsightsQueues = true;

  const initialRouterConfig = {
    location: {
      pathname: `/organizations/${organization.slug}/insights/backend/queues/`,
      query: {statsPeriod: '10d', project: '1'},
    },
    route: `/organizations/:orgId/insights/backend/queues/`,
  };

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
    render(<QueuesLandingPage />, {
      organization,
      initialRouterConfig,
    });
    await screen.findByRole('table', {name: 'Queues'});
    screen.getByPlaceholderText('Search for more destinations');
    screen.getByText('Average Duration');
    screen.getByText('Published vs Processed');
    expect(eventsStatsMock).toHaveBeenCalled();
    expect(eventsMock).toHaveBeenCalled();
  });
});
