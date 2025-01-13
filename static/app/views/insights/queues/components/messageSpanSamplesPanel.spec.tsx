import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen, waitForElementToBeRemoved} from 'sentry-test/reactTestingLibrary';

import {useLocation} from 'sentry/utils/useLocation';
import usePageFilters from 'sentry/utils/usePageFilters';
import {MessageSpanSamplesPanel} from 'sentry/views/insights/queues/components/messageSpanSamplesPanel';

jest.mock('sentry/utils/useLocation');
jest.mock('sentry/utils/usePageFilters');

describe('messageSpanSamplesPanel', () => {
  const organization = OrganizationFixture();

  let eventsRequestMock: jest.Mock;
  let eventsStatsRequestMock: jest.Mock;
  let samplesRequestMock: jest.Mock;
  let spanFieldTagsMock: jest.Mock;

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
        data: [
          {
            'sum(span.duration)': 10.0,
            'trace_status_rate(ok)': 0.8,
            'count_op(queue.publish)': 222,
            'count_op(queue.process)': 333,
            'avg_if(span.duration,span.op,queue.publish)': 3.0,
            'avg_if(span.duration,span.op,queue.process)': 4.0,
            'count()': 555,
            'avg(messaging.message.receive.latency)': 2.0,
            'avg(span.duration)': 3.5,
          },
        ],
        meta: {
          fields: {
            'sum(span.duration)': 'duration',
            'trace_status_rate(ok)': 'percentage',
            'count_op(queue.publish)': 'integer',
            'count_op(queue.process)': 'integer',
            'avg_if(span.duration,span.op,queue.publish)': 'duration',
            'avg_if(span.duration,span.op,queue.process)': 'duration',
            'count()': 'integer',
            'avg(messaging.message.receive.latency)': 'number',
            'avg(span.duration)': 'duration',
          },
          units: {
            'sum(span.duration)': 'millisecond',
            'trace_status_rate(ok)': null,
            'count_op(queue.publish)': null,
            'count_op(queue.process)': null,
            'avg_if(span.duration,span.op,queue.publish)': 'millisecond',
            'avg_if(span.duration,span.op,queue.process)': 'millisecond',
            'count()': null,
            'avg(messaging.message.receive.latency)': null,
            'avg(span.duration)': 'millisecond',
          },
        },
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

    spanFieldTagsMock = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/spans/fields/`,
      method: 'GET',
      body: [
        {
          key: 'api_key',
          name: 'Api Key',
        },
        {
          key: 'bytes.size',
          name: 'Bytes.Size',
        },
      ],
    });

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/recent-searches/`,
      body: [],
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
        'span.op': 'queue.process',
      },
      hash: '',
      state: undefined,
      action: 'PUSH',
      key: '',
    });
    render(<MessageSpanSamplesPanel />, {organization});
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
            'trace_status_rate(ok)',
            'time_spent_percentage(app,span.duration)',
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
    expect(spanFieldTagsMock).toHaveBeenNthCalledWith(
      1,
      `/organizations/${organization.slug}/spans/fields/`,
      expect.objectContaining({
        method: 'GET',
        query: {
          project: [],
          environment: [],
          statsPeriod: '1h',
        },
      })
    );
    expect(screen.getByRole('table', {name: 'Span Samples'})).toBeInTheDocument();
    expect(screen.getByText(/Consumer/)).toBeInTheDocument();
    // Metrics Ribbon
    expect(screen.getByText('Processed')).toBeInTheDocument();
    expect(screen.getByText('Error Rate')).toBeInTheDocument();
    expect(screen.getByText('Avg Time In Queue')).toBeInTheDocument();
    expect(screen.getByText('Avg Processing Time')).toBeInTheDocument();
    expect(screen.getByText('333')).toBeInTheDocument();
    expect(screen.getByText('20%')).toBeInTheDocument();
    expect(screen.getByText('2.00ms')).toBeInTheDocument();
    expect(screen.getByText('4.00ms')).toBeInTheDocument();
  });

  it('renders producer panel', async () => {
    jest.mocked(useLocation).mockReturnValue({
      pathname: '',
      search: '',
      query: {
        transaction: 'sentry.tasks.store.save_event',
        destination: 'event-queue',
        'span.op': 'queue.publish',
      },
      hash: '',
      state: undefined,
      action: 'PUSH',
      key: '',
    });
    render(<MessageSpanSamplesPanel />, {organization});
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
            'trace_status_rate(ok)',
            'time_spent_percentage(app,span.duration)',
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
    expect(spanFieldTagsMock).toHaveBeenCalledWith(
      `/organizations/${organization.slug}/spans/fields/`,
      expect.objectContaining({
        method: 'GET',
        query: {
          project: [],
          environment: [],
          statsPeriod: '1h',
        },
      })
    );
    expect(screen.getByRole('table', {name: 'Span Samples'})).toBeInTheDocument();
    expect(screen.getByText(/Producer/)).toBeInTheDocument();
    // Metrics Ribbon
    expect(screen.getByText('Published')).toBeInTheDocument();
    expect(screen.getByText('Error Rate')).toBeInTheDocument();
    expect(screen.getByText('222')).toBeInTheDocument();
    expect(screen.getByText('20%')).toBeInTheDocument();
  });
});
