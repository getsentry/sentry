import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen, waitForElementToBeRemoved} from 'sentry-test/reactTestingLibrary';

import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import {MessageSamplesPanel} from 'sentry/views/performance/queues/messageSamplesPanel';

jest.mock('sentry/utils/useLocation');
jest.mock('sentry/utils/usePageFilters');
jest.mock('sentry/utils/useOrganization');

describe('messageSamplesPanel', () => {
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
            'span.duration': 320.300102,
          },
        ],
      },
    });
  });

  afterAll(() => {
    jest.resetAllMocks();
  });

  it('renders consumer panel', async () => {
    jest.mocked(useLocation).mockReturnValue({
      pathname: '',
      search: '',
      query: {
        transaction: 'sentry.tasks.store.save_event',
        destination: 'event-queue',
        op: 'queue.process',
      },
      hash: '',
      state: undefined,
      action: 'PUSH',
      key: '',
    });
    render(<MessageSamplesPanel />);
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
            'sum(span.duration)',
            'avg(span.duration)',
            'avg_if(span.duration,span.op,queue.publish)',
            'avg_if(span.duration,span.op,queue.process)',
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
            'measurements.messaging.message.retry.count',
            'messaging.message.id',
            'trace.status',
            'span.duration',
          ],
          firstBound: 2666.6666666666665,
          lowerBound: 0,
          project: [],
          query:
            'span.op:queue.process transaction:sentry.tasks.store.save_event messaging.destination.name:event-queue',
          referrer: undefined,
          secondBound: 5333.333333333333,
          statsPeriod: '10d',
          upperBound: 8000,
        }),
      })
    );
    expect(screen.getByRole('table', {name: 'Span Samples'})).toBeInTheDocument();
  });

  it('renders producer panel', async () => {
    jest.mocked(useLocation).mockReturnValue({
      pathname: '',
      search: '',
      query: {
        transaction: 'sentry.tasks.store.save_event',
        destination: 'event-queue',
        op: 'queue.publish',
      },
      hash: '',
      state: undefined,
      action: 'PUSH',
      key: '',
    });
    render(<MessageSamplesPanel />);
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
            'sum(span.duration)',
            'avg(span.duration)',
            'avg_if(span.duration,span.op,queue.publish)',
            'avg_if(span.duration,span.op,queue.process)',
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
            'measurements.messaging.message.retry.count',
            'messaging.message.id',
            'trace.status',
            'span.duration',
          ],
          firstBound: 2666.6666666666665,
          lowerBound: 0,
          project: [],
          query:
            'span.op:queue.publish transaction:sentry.tasks.store.save_event messaging.destination.name:event-queue',
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
