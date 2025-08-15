import {OrganizationFixture} from 'sentry-fixture/organization';
import {PageFilterStateFixture} from 'sentry-fixture/pageFilters';
import {ProjectFixture} from 'sentry-fixture/project';

import {render, screen, waitForElementToBeRemoved} from 'sentry-test/reactTestingLibrary';

import ProjectsStore from 'sentry/stores/projectsStore';
import {useLocation} from 'sentry/utils/useLocation';
import usePageFilters from 'sentry/utils/usePageFilters';
import {useReleaseStats} from 'sentry/utils/useReleaseStats';
import {Referrer} from 'sentry/views/insights/queues/referrers';
import PageWithProviders from 'sentry/views/insights/queues/views/destinationSummaryPage';

jest.mock('sentry/utils/useLocation');
jest.mock('sentry/utils/usePageFilters');
jest.mock('sentry/utils/useReleaseStats');

describe('destinationSummaryPage', () => {
  const organization = OrganizationFixture({
    features: ['insights-addon-modules'],
  });
  const project = ProjectFixture({firstTransactionEvent: true});

  jest.mocked(usePageFilters).mockReturnValue(PageFilterStateFixture());

  jest.mocked(useLocation).mockReturnValue({
    pathname: '',
    search: '',
    query: {statsPeriod: '10d', project: project.id},
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
  let latencyEventsStatsMock: jest.Mock;
  let throughputEventsStatsMock: jest.Mock;

  beforeEach(() => {
    ProjectsStore.loadInitialData([project]);
    eventsMock = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events/`,
      method: 'GET',
      body: {data: []},
    });

    latencyEventsStatsMock = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events-stats/`,
      method: 'GET',
      body: {
        'avg(span.duration)': {
          data: [[1739378162, [{count: 1}]]],
          meta: {
            fields: {'avg(span.duration)': 'duration'},
            units: {'avg(span.duration)': 'millisecond'},
          },
        },
        'avg(messaging.message.receive.latency)': {
          data: [[1739378162, [{count: 1}]]],
          meta: {fields: {epm: 'rate'}, units: {epm: '1/second'}},
        },
      },
      match: [
        MockApiClient.matchQuery({
          referrer: Referrer.QUEUES_SUMMARY_LATENCY_CHART,
        }),
      ],
    });

    throughputEventsStatsMock = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events-stats/`,
      method: 'GET',
      body: {
        'queue.process': {
          data: [[1739378162, [{count: 1}]]],
          meta: {fields: {epm: 'rate'}, units: {epm: '1/second'}},
        },
        'queue.publish': {
          data: [[1739378162, [{count: 1}]]],
          meta: {fields: {epm: 'rate'}, units: {epm: '1/second'}},
        },
      },
      match: [
        MockApiClient.matchQuery({
          referrer: Referrer.QUEUES_SUMMARY_THROUGHPUT_CHART,
        }),
      ],
    });
  });

  it('renders', async () => {
    render(<PageWithProviders />, {organization, deprecatedRouterMocks: true});
    await screen.findByRole('table', {name: 'Transactions'});
    await waitForElementToBeRemoved(() => screen.queryAllByTestId('loading-indicator'));
    screen.getByText('Average Duration');
    screen.getByText('Published vs Processed');
    expect(latencyEventsStatsMock).toHaveBeenCalledTimes(1);
    expect(throughputEventsStatsMock).toHaveBeenCalledTimes(1);
    expect(eventsMock).toHaveBeenCalled();
  });
});
