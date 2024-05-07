import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import useOrganization from 'sentry/utils/useOrganization';
import {QueuesTable} from 'sentry/views/performance/queues/queuesTable';

jest.mock('sentry/utils/useOrganization');

describe('queuesTable', () => {
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
            'messaging.destination.name': 'celery.backend_cleanup',
            'count()': 2,
            'count_op(queue.publish)': 0,
            'count_op(queue.process)': 2,
            'sum(span.self_time)': 6,
            'avg(span.self_time)': 3,
            'avg_if(span.self_time,span.op,queue.publish)': 0,
            'avg_if(span.self_time,span.op,queue.process)': 3,
            'avg(messaging.message.receive.latency)': 20,
          },
        ],
        meta: {
          fields: {
            'count()': 'integer',
            'count_op(queue.publish)': 'integer',
            'count_op(queue.process)': 'integer',
            'sum(span.self_time)': 'duration',
            'avg(span.self_time)': 'duration',
            'avg_if(span.self_time,span.op,queue.publish)': 'duration',
            'avg_if(span.self_time,span.op,queue.process)': 'duration',
            'avg(messaging.message.receive.latency)': 'duration',
          },
        },
      },
    });
  });
  it('renders', async () => {
    render(<QueuesTable />);
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
            'sum(span.self_time)',
            'avg(span.self_time)',
            'avg_if(span.self_time,span.op,queue.publish)',
            'avg_if(span.self_time,span.op,queue.process)',
            'avg(messaging.message.receive.latency)',
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
    expect(screen.getByRole('button', {name: 'Next'})).toBeInTheDocument();
  });
});
