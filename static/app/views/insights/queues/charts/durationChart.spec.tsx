import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen, waitForElementToBeRemoved} from 'sentry-test/reactTestingLibrary';

import {DurationChart} from 'sentry/views/insights/queues/charts/durationChart';
import {Referrer} from 'sentry/views/insights/queues/referrers';

describe('durationChart', () => {
  const organization = OrganizationFixture();

  let eventsStatsMock: jest.Mock;

  beforeEach(() => {
    eventsStatsMock = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events-stats/`,
      method: 'GET',
      body: {
        data: [[1739378162, [{count: 1}]]],
      },
    });
  });
  it('renders', async () => {
    render(
      <DurationChart destination="events" referrer={Referrer.QUEUES_SUMMARY_CHARTS} />,
      {organization}
    );
    screen.getByText('Average Duration');
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
