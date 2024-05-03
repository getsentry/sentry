import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import {MessageConsumerSamplesPanel} from 'sentry/views/performance/queues/messageConsumerSamplesPanel';

jest.mock('sentry/utils/useLocation');
jest.mock('sentry/utils/usePageFilters');
jest.mock('sentry/utils/useOrganization');

describe('messageConsumerSamplesPanel', () => {
  const organization = OrganizationFixture();

  let eventsRequestMock, eventsStatsRequestMock;

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
  });

  afterAll(() => {
    jest.resetAllMocks();
  });

  it('renders', () => {
    render(<MessageConsumerSamplesPanel />);
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
    expect(screen.getByRole('table', {name: 'Span Samples'})).toBeInTheDocument();
  });
});
