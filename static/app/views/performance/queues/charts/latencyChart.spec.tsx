import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen, waitForElementToBeRemoved} from 'sentry-test/reactTestingLibrary';

import {LatencyChart} from 'sentry/views/performance/queues/charts/latencyChart';
import {Referrer} from 'sentry/views/performance/queues/referrers';

describe('latencyChart', () => {
  const organization = OrganizationFixture();

  let eventsStatsMock;

  beforeEach(() => {
    eventsStatsMock = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events-stats/`,
      method: 'GET',
      body: {
        data: [],
      },
    });
  });
  it('renders', async () => {
    render(
      <LatencyChart destination="events" referrer={Referrer.QUEUES_SUMMARY_CHARTS} />,
      {organization}
    );
    screen.getByText('Avg Latency');
    expect(eventsStatsMock).toHaveBeenCalledWith(
      '/organizations/org-slug/events-stats/',
      expect.objectContaining({
        query: expect.objectContaining({
          yAxis: [
            'avg_if(span.duration,span.op,queue.publish)',
            'avg_if(span.duration,span.op,queue.process)',
            'avg(messaging.message.receive.latency)',
            'count_op(queue.publish)',
            'count_op(queue.process)',
          ],
          query:
            'span.op:[queue.process,queue.publish] messaging.destination.name:events',
        }),
      })
    );
    await waitForElementToBeRemoved(() => screen.queryAllByTestId('loading-indicator'));
  });
});
