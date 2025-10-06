import {OrganizationFixture} from 'sentry-fixture/organization';
import {TimeSeriesFixture} from 'sentry-fixture/timeSeries';

import {render, screen, waitForElementToBeRemoved} from 'sentry-test/reactTestingLibrary';

import {useReleaseStats} from 'sentry/utils/useReleaseStats';
import {ThroughputChart} from 'sentry/views/insights/queues/charts/throughputChart';
import {Referrer} from 'sentry/views/insights/queues/referrers';

jest.mock('sentry/utils/useReleaseStats');

describe('throughputChart', () => {
  const organization = OrganizationFixture();

  let eventsTimeseriesMock!: jest.Mock;

  jest.mocked(useReleaseStats).mockReturnValue({
    isLoading: false,
    isPending: false,
    isError: false,
    error: null,
    releases: [],
  });

  beforeEach(() => {
    eventsTimeseriesMock = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events-timeseries/`,
      method: 'GET',
      body: {
        timeSeries: [
          TimeSeriesFixture({
            yAxis: 'epm()',
            values: [{value: 1, timestamp: 1739378162}],
            groupBy: [{key: 'span.op', value: 'queue.process'}],
          }),
          TimeSeriesFixture({
            yAxis: 'epm()',
            values: [{value: 1, timestamp: 1739378162}],
            groupBy: [{key: 'span.op', value: 'queue.publish'}],
          }),
        ],
      },
    });
  });
  it('renders', async () => {
    render(
      <ThroughputChart
        id="throughput-chart-test"
        referrer={Referrer.QUEUES_SUMMARY_THROUGHPUT_CHART}
      />,
      {organization}
    );
    screen.getByText('Published vs Processed');
    expect(eventsTimeseriesMock).toHaveBeenCalledWith(
      '/organizations/org-slug/events-timeseries/',
      expect.objectContaining({
        query: expect.objectContaining({
          yAxis: ['epm()'],
          groupBy: ['span.op'],
          topEvents: 2,
          query: 'span.op:[queue.publish, queue.process]',
        }),
      })
    );
    await waitForElementToBeRemoved(() => screen.queryAllByTestId('loading-indicator'));
  });
});
