import {OrganizationFixture} from 'sentry-fixture/organization';
import {PageFilterStateFixture} from 'sentry-fixture/pageFilters';
import {ProjectFixture} from 'sentry-fixture/project';
import {TimeSeriesFixture} from 'sentry-fixture/timeSeries';

import {render, screen, waitForElementToBeRemoved} from 'sentry-test/reactTestingLibrary';

import ProjectsStore from 'sentry/stores/projectsStore';
import {RateUnit} from 'sentry/utils/discover/fields';
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
    features: ['insight-modules'],
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
      url: `/organizations/${organization.slug}/events-timeseries/`,
      method: 'GET',
      body: {
        timeSeries: [
          TimeSeriesFixture({
            yAxis: 'avg(messaging.message.receive.latency)',
            values: [{value: 1, timestamp: 1739378162000}],
          }),
          TimeSeriesFixture({
            yAxis: 'avg(span.duration)',
            values: [{value: 1, timestamp: 1739378162000}],
          }),
        ],
      },
      match: [
        MockApiClient.matchQuery({
          referrer: Referrer.QUEUES_SUMMARY_LATENCY_CHART,
        }),
      ],
    });

    // Mock for unchanged throughput chart that still uses events-stats
    throughputEventsStatsMock = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events-timeseries/`,
      method: 'GET',
      body: {
        timeSeries: [
          TimeSeriesFixture({
            yAxis: 'epm()',
            meta: {
              interval: 1,
              valueType: 'rate',
              valueUnit: RateUnit.PER_SECOND,
            },
            groupBy: [{key: 'span.op', value: 'queue.process'}],
            values: [{value: 1, timestamp: 1739378162000}],
          }),
          TimeSeriesFixture({
            yAxis: 'epm()',
            meta: {
              interval: 1,
              valueType: 'rate',
              valueUnit: RateUnit.PER_SECOND,
            },
            groupBy: [{key: 'span.op', value: 'queue.publish'}],
            values: [{value: 1, timestamp: 1739378162000}],
          }),
        ],
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
