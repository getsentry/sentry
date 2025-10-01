import {OrganizationFixture} from 'sentry-fixture/organization';
import {TimeSeriesFixture} from 'sentry-fixture/timeSeries';

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
      url: `/organizations/${organization.slug}/events-timeseries/`,
      method: 'GET',
      body: {
        timeSeries: [
          TimeSeriesFixture({
            yAxis: 'avg(messaging.message.receive.latency)',
            values: [{value: 1, timestamp: 1739378162000}],
          }),
          TimeSeriesFixture({
            yAxis: 'avg(span.duration)',
            values: [{value: 1, timestamp: 1739378162000}],
          }),
        ],
      },
    });
  });
  it('renders', async () => {
    render(
      <LatencyChart
        id="latency-chart-test"
        destination="events"
        referrer={Referrer.QUEUES_SUMMARY_LATENCY_CHART}
      />,
      {organization}
    );
    screen.getByText('Average Duration');
    expect(eventsStatsMock).toHaveBeenCalledWith(
      '/organizations/org-slug/events-timeseries/',
      expect.objectContaining({
        query: expect.objectContaining({
          yAxis: ['avg(messaging.message.receive.latency)', 'avg(span.duration)'],
          query: 'span.op:queue.process messaging.destination.name:events',
        }),
      })
    );
    await waitForElementToBeRemoved(() => screen.queryAllByTestId('loading-indicator'));
  });
});
