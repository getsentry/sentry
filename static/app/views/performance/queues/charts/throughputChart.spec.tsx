import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen, waitForElementToBeRemoved} from 'sentry-test/reactTestingLibrary';

import {ThroughputChart} from 'sentry/views/performance/queues/charts/throughputChart';
import {Referrer} from 'sentry/views/performance/queues/referrers';

describe('throughputChart', () => {
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
    render(<ThroughputChart referrer={Referrer.QUEUES_SUMMARY_CHARTS} />, {organization});
    screen.getByText('Published vs Processed');
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
          query: 'span.op:[queue.process,queue.publish]',
        }),
      })
    );
    await waitForElementToBeRemoved(() => screen.queryAllByTestId('loading-indicator'));
  });
});
