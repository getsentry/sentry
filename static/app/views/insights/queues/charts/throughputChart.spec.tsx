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
        'queue.process': {
          data: [[1739378162, [{count: 1}]]],
          meta: {fields: {epm: 'rate'}, units: {epm: '1/second'}},
        },
        'queue.publish': {
          data: [[1739378162, [{count: 1}]]],
          meta: {fields: {epm: 'rate'}, units: {epm: '1/second'}},
        },
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
    expect(eventsStatsMock).toHaveBeenCalledWith(
      '/organizations/org-slug/events-stats/',
      expect.objectContaining({
        query: expect.objectContaining({
          yAxis: 'epm()',
          field: ['epm()', 'span.op'],
          topEvents: '2',
          query: 'span.op:[queue.publish, queue.process]',
        }),
      })
    );
    await waitForElementToBeRemoved(() => screen.queryAllByTestId('loading-indicator'));
  });
});
