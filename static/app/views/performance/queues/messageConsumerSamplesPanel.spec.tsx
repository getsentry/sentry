import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen, waitForElementToBeRemoved} from 'sentry-test/reactTestingLibrary';

import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import {MessageConsumerSamplesPanel} from 'sentry/views/performance/queues/messageConsumerSamplesPanel';

jest.mock('sentry/utils/useLocation');
jest.mock('sentry/utils/usePageFilters');
jest.mock('sentry/utils/useOrganization');

describe('messageConsumerSamplesPanel', () => {
  const organization = OrganizationFixture();

  let eventsRequestMock, eventsStatsRequestMock, samplesRequestMock;

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
      projects: [],
    },
  });

  jest.mocked(useLocation).mockReturnValue({
    pathname: '',
    search: '',
    query: {transaction: 'sentry.tasks.store.save_event', destination: 'event-queue'},
    hash: '',
    state: undefined,
    action: 'PUSH',
    key: '',
  });

  jest.mocked(useOrganization).mockReturnValue(organization);

  beforeEach(() => {
    eventsStatsRequestMock = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events-stats/`,
      method: 'GET',
      body: {
        data: [[1699907700, [{count: 7810}]]],
        meta: {},
      },
    });

    eventsRequestMock = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events/`,
      method: 'GET',
      body: {
        data: [],
        meta: {},
      },
    });

    samplesRequestMock = MockApiClient.addMockResponse({
      url: `/api/0/organizations/${organization.slug}/spans-samples/`,
      method: 'GET',
      body: {
        data: [
          {
            span_id: '123',
            trace: 'abc',
            project: 'project',
            timestamp: '2024-03-25T20:31:36+00:00',
            'span.self_time': 320.300102,
          },
        ],
      },
    });
  });

  afterAll(() => {
    jest.resetAllMocks();
  });

  it('renders', async () => {
    render(<MessageConsumerSamplesPanel />);
    await waitForElementToBeRemoved(() => screen.queryAllByTestId('loading-indicator'));
    expect(eventsStatsRequestMock).toHaveBeenCalled();
    expect(eventsRequestMock).toHaveBeenCalledWith(
      `/organizations/${organization.slug}/events/`,
      expect.objectContaining({
        method: 'GET',
        query: expect.objectContaining({
          dataset: 'spansMetrics',
          environment: [],
          field: [
            'count()',
            'count_op(queue.publish)',
            'count_op(queue.process)',
            'sum(span.self_time)',
            'avg(span.self_time)',
            'avg_if(span.self_time,span.op,queue.publish)',
            'avg_if(span.self_time,span.op,queue.process)',
            'avg(messaging.message.receive.latency)',
          ],
          per_page: 10,
          project: [],
          query:
            'span.op:[queue.process,queue.publish] messaging.destination.name:event-queue transaction:sentry.tasks.store.save_event',
          statsPeriod: '10d',
        }),
      })
    );
    expect(samplesRequestMock).toHaveBeenCalledWith(
      `/api/0/organizations/${organization.slug}/spans-samples/`,
      expect.objectContaining({
        query: expect.objectContaining({
          additionalFields: [
            'trace',
            'transaction.id',
            'span.description',
            'measurements.messaging.message.body.size',
            'measurements.messaging.message.receive.latency',
            'messaging.message.id',
            'trace.status',
            'span.self_time',
          ],
          firstBound: 2666.6666666666665,
          lowerBound: 0,
          project: [],
          query:
            'span.op:queue.process OR span.op:queue.publish transaction:sentry.tasks.store.save_event messaging.destination.name:event-queue',
          referrer: undefined,
          secondBound: 5333.333333333333,
          statsPeriod: '10d',
          upperBound: 8000,
        }),
      })
    );
    expect(screen.getByRole('table', {name: 'Span Samples'})).toBeInTheDocument();
  });
});
