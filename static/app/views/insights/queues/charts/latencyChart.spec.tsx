import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen, waitForElementToBeRemoved} from 'sentry-test/reactTestingLibrary';

import {useReleaseStats} from 'sentry/utils/useReleaseStats';
import {LatencyChart} from 'sentry/views/insights/queues/charts/latencyChart';
import {Referrer} from 'sentry/views/insights/queues/referrers';

jest.mock('sentry/utils/useReleaseStats');

describe('latencyChart', () => {
  const organization = OrganizationFixture();

  jest.mocked(useReleaseStats).mockReturnValue({
    isLoading: false,
    isPending: false,
    isError: false,
    error: null,
    releases: [],
  });

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
      <LatencyChart destination="events" referrer={Referrer.QUEUES_SUMMARY_CHARTS} />,
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
