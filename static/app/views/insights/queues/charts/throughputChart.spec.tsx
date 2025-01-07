import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen, waitForElementToBeRemoved} from 'sentry-test/reactTestingLibrary';

import {ThroughputChart} from 'sentry/views/insights/queues/charts/throughputChart';
import {Referrer} from 'sentry/views/insights/queues/referrers';

describe('throughputChart', () => {
  const organization = OrganizationFixture();

  let eventsStatsMock!: jest.Mock;

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
            'avg(span.duration)',
            'avg(messaging.message.receive.latency)',
            'spm()',
          ],
          query: 'span.op:queue.process',
        }),
      })
    );
    expect(eventsStatsMock).toHaveBeenCalledWith(
      '/organizations/org-slug/events-stats/',
      expect.objectContaining({
        query: expect.objectContaining({
          yAxis: ['avg(span.duration)', 'spm()'],
          query: 'span.op:queue.publish',
        }),
      })
    );
    await waitForElementToBeRemoved(() => screen.queryAllByTestId('loading-indicator'));
  });
});
