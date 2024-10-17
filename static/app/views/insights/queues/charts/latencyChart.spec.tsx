import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen, waitForElementToBeRemoved} from 'sentry-test/reactTestingLibrary';

import {LatencyChart} from 'sentry/views/insights/queues/charts/latencyChart';
import {Referrer} from 'sentry/views/insights/queues/referrers';

describe('latencyChart', () => {
  const organization = OrganizationFixture();

  let eventsStatsMock: jest.Mock;

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
            'avg(span.duration)',
            'avg(messaging.message.receive.latency)',
            'spm()',
          ],
          query: 'span.op:queue.process messaging.destination.name:events',
        }),
      })
    );
    await waitForElementToBeRemoved(() => screen.queryAllByTestId('loading-indicator'));
  });
});
