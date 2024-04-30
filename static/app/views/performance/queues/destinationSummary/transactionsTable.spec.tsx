import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import useOrganization from 'sentry/utils/useOrganization';
import {TransactionsTable} from 'sentry/views/performance/queues/destinationSummary/transactionsTable';

jest.mock('sentry/utils/useOrganization');

describe('transactionsTable', () => {
  const organization = OrganizationFixture();
  jest.mocked(useOrganization).mockReturnValue(organization);

  let eventsMock;

  const pageLinks =
    '<https://sentry.io/fake/previous>; rel="previous"; results="false"; cursor="0:0:1", ' +
    '<https://sentry.io/fake/next>; rel="next"; results="true"; cursor="0:20:0"';

  beforeEach(() => {
    eventsMock = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events/`,
      headers: {Link: pageLinks},
      method: 'GET',
      body: {
        data: [
          {
            transaction: 'celery.backend_cleanup',
            'avg_if(span.self_time,span.op,queue.task.celery)': 3,
            'sum(span.self_time)': 6,
            'count_op(queue.submit.celery)': 0,
            'count_op(queue.task.celery)': 2,
            'avg_if(span.self_time,span.op,queue.submit.celery)': 0,
            'count()': 2,
            'avg(span.self_time)': 3,
          },
        ],
        meta: {
          fields: {
            'avg_if(span.self_time,span.op,queue.task.celery)': 'duration',
            'count_op(queue.submit.celery)': 'integer',
            'avg_if(span.self_time,span.op,queue.submit.celery)': 'duration',
            'count_op(queue.task.celery)': 'integer',
            'sum(span.self_time)': 'duration',
            'count()': 'integer',
            'avg(span.self_time)': 'duration',
          },
        },
      },
    });
  });
  it('renders', async () => {
    render(<TransactionsTable />);
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
            'count()',
            'count_op(queue.submit.celery)',
            'count_op(queue.task.celery)',
            'sum(span.self_time)',
            'avg(span.self_time)',
            'avg_if(span.self_time,span.op,queue.submit.celery)',
            'avg_if(span.self_time,span.op,queue.task.celery)',
          ],
          dataset: 'spansMetrics',
        }),
      })
    );
    await screen.findByText('celery.backend_cleanup');
    expect(screen.getByRole('cell', {name: '3.00ms'})).toBeInTheDocument();
    expect(screen.getByRole('cell', {name: '2'})).toBeInTheDocument();
    expect(screen.getByRole('cell', {name: '6.00ms'})).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Next'})).toBeInTheDocument();
  });
});
