import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen, waitForElementToBeRemoved} from 'sentry-test/reactTestingLibrary';

import {useReleaseStats} from 'sentry/utils/useReleaseStats';
import {ThroughputChart} from 'sentry/views/insights/queues/charts/throughputChart';
import {Referrer} from 'sentry/views/insights/queues/referrers';

jest.mock('sentry/utils/useReleaseStats');

describe('throughputChart', () => {
  const organization = OrganizationFixture();

  let eventsStatsMock!: jest.Mock;

  jest.mocked(useReleaseStats).mockReturnValue({
    isLoading: false,
    isPending: false,
    isError: false,
    error: null,
    releases: [],
  });

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
