import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import useOrganization from 'sentry/utils/useOrganization';
import {QueuesTable} from 'sentry/views/performance/queues/queuesTable';

jest.mock('sentry/utils/useOrganization');

describe('queuesTable', () => {
  const organization = OrganizationFixture();
  jest.mocked(useOrganization).mockReturnValue(organization);

  let eventsMock;

  beforeEach(() => {
    eventsMock = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events/`,
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
    render(<QueuesTable />);
    screen.getByText('Destination');
    screen.getByText('Avg Time in Queue');
    screen.getByText('Avg Processing Time');
    screen.getByText('Error Rate');
    screen.getByText('Published');
    screen.getByText('Processed');
    screen.getByText('Time Spent');
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
    screen.getByText('3.00ms');
    screen.getByText(2);
    screen.getByText('6.00ms');
  });
});
