import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import {useLocation} from 'sentry/utils/useLocation';
import {QueryParameterNames} from 'sentry/views/insights/common/views/queryParameters';
import {TransactionsTable} from 'sentry/views/insights/queues/components/tables/transactionsTable';

jest.mock('sentry/utils/useLocation');

describe('transactionsTable', () => {
  const organization = OrganizationFixture();

  let eventsMock: jest.Mock;

  const pageLinks =
    '<https://sentry.io/fake/previous>; rel="previous"; results="false"; cursor="0:0:1", ' +
    '<https://sentry.io/fake/next>; rel="next"; results="true"; cursor="0:20:0"';

  beforeEach(() => {
    jest.mocked(useLocation).mockReturnValue({
      pathname: '',
      search: '',
      query: {statsPeriod: '10d', project: '1'},
      hash: '',
      state: undefined,
      action: 'PUSH',
      key: '',
    });

    eventsMock = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events/`,
      headers: {Link: pageLinks},
      method: 'GET',
      body: {
        data: [
          {
            transaction: 'celery.backend_cleanup',
            'span.op': 'queue.process',
            'count()': 2,
            'count_op(queue.publish)': 0,
            'count_op(queue.process)': 2,
            'sum(span.duration)': 6,
            'avg(span.duration)': 3,
            'avg_if(span.duration,span.op,queue.publish)': 0,
            'avg_if(span.duration,span.op,queue.process)': 3,
            'avg(messaging.message.receive.latency)': 20,
            'trace_status_rate(ok)': 0.8,
            'time_spent_percentage(app,span.duration)': 0.5,
          },
        ],
        meta: {
          fields: {
            'count()': 'integer',
            'count_op(queue.publish)': 'integer',
            'count_op(queue.process)': 'integer',
            'sum(span.duration)': 'duration',
            'avg(span.duration)': 'duration',
            'avg_if(span.duration,span.op,queue.publish)': 'duration',
            'avg_if(span.duration,span.op,queue.process)': 'duration',
            'avg(messaging.message.receive.latency)': 'duration',
            'trace_status_rate(ok)': 'percentage',
            'time_spent_percentage(app,span.duration)': 'percentage',
          },
        },
      },
    });
  });
  it('renders', async () => {
    render(<TransactionsTable />, {organization});
    expect(screen.getByRole('table', {name: 'Transactions'})).toBeInTheDocument();

    expect(screen.getByRole('columnheader', {name: 'Transactions'})).toBeInTheDocument();
    expect(screen.getByRole('columnheader', {name: 'Type'})).toBeInTheDocument();
    expect(
      screen.getByRole('columnheader', {name: 'Avg Time in Queue'})
    ).toBeInTheDocument();
    expect(
      screen.getByRole('columnheader', {name: 'Avg Processing Time'})
    ).toBeInTheDocument();
    expect(screen.getByRole('columnheader', {name: 'Error Rate'})).toBeInTheDocument();
    expect(screen.getByRole('columnheader', {name: 'Published'})).toBeInTheDocument();
    expect(screen.getByRole('columnheader', {name: 'Processed'})).toBeInTheDocument();
    expect(screen.getByRole('columnheader', {name: 'Time Spent'})).toBeInTheDocument();

    expect(eventsMock).toHaveBeenCalledWith(
      '/organizations/org-slug/events/',
      expect.objectContaining({
        query: expect.objectContaining({
          field: [
            'transaction',
            'span.op',
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
          dataset: 'spansMetrics',
        }),
      })
    );
    await screen.findByText('celery.backend_cleanup');
    expect(screen.getByRole('cell', {name: '3.00ms'})).toBeInTheDocument();
    expect(screen.getByRole('cell', {name: '2'})).toBeInTheDocument();
    expect(screen.getByRole('cell', {name: '6.00ms'})).toBeInTheDocument();
    expect(screen.getByRole('cell', {name: '20.00ms'})).toBeInTheDocument();
    expect(screen.getByRole('cell', {name: 'Consumer'})).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Next'})).toBeInTheDocument();
  });

  it('sorts by processing time', async () => {
    jest.mocked(useLocation).mockReturnValue({
      pathname: '',
      search: '',
      query: {
        statsPeriod: '10d',
        project: '1',
        [QueryParameterNames.DESTINATIONS_SORT]:
          '-avg_if(span.duration,span.op,queue.process)',
      },
      hash: '',
      state: undefined,
      action: 'PUSH',
      key: '',
    });

    render(<TransactionsTable />, {organization});

    expect(eventsMock).toHaveBeenCalledWith(
      '/organizations/org-slug/events/',
      expect.objectContaining({
        query: expect.objectContaining({
          field: [
            'transaction',
            'span.op',
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
          dataset: 'spansMetrics',
          sort: '-avg_if(span.duration,span.op,queue.process)',
        }),
      })
    );
    await screen.findByText('celery.backend_cleanup');
  });
});
