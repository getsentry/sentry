import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import {QueuesTable} from 'sentry/views/insights/queues/components/tables/queuesTable';
import {SpanIndexedField} from 'sentry/views/insights/types';

describe('queuesTable', () => {
  const organization = OrganizationFixture();

  let eventsMock: jest.Mock;

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
            'messaging.destination.name': 'celery.backend_cleanup',
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
    render(
      <QueuesTable
        sort={{field: 'time_spent_percentage(app,span.duration)', kind: 'desc'}}
      />,
      {organization}
    );
    expect(screen.getByRole('table', {name: 'Queues'})).toBeInTheDocument();
    expect(screen.getByRole('columnheader', {name: 'Destination'})).toBeInTheDocument();
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
            'messaging.destination.name',
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
    expect(screen.getByRole('cell', {name: '20%'})).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Next'})).toBeInTheDocument();
  });
  it('searches for a destination and sorts', async () => {
    render(
      <QueuesTable
        destination="*events*"
        sort={{field: SpanIndexedField.MESSAGING_MESSAGE_DESTINATION_NAME, kind: 'desc'}}
      />,
      {organization}
    );
    expect(eventsMock).toHaveBeenCalledWith(
      '/organizations/org-slug/events/',
      expect.objectContaining({
        query: expect.objectContaining({
          field: [
            'messaging.destination.name',
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
          sort: '-messaging.destination.name',
          query:
            'span.op:[queue.process,queue.publish] messaging.destination.name:*events*',
        }),
      })
    );
    await screen.findByText('celery.backend_cleanup');
  });
});
