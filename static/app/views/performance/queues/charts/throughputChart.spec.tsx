import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen, waitForElementToBeRemoved} from 'sentry-test/reactTestingLibrary';

import useOrganization from 'sentry/utils/useOrganization';
import {ThroughputChart} from 'sentry/views/performance/queues/charts/throughputChart';

jest.mock('sentry/utils/useOrganization');

describe('throughputChart', () => {
  const organization = OrganizationFixture();
  jest.mocked(useOrganization).mockReturnValue(organization);

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
    render(<ThroughputChart />);
    screen.getByText('Published vs Processed');
    expect(eventsStatsMock).toHaveBeenCalledWith(
      '/organizations/org-slug/events-stats/',
      expect.objectContaining({
        query: expect.objectContaining({
          yAxis: [
            'avg_if(span.self_time,span.op,queue.publish)',
            'avg_if(span.self_time,span.op,queue.process)',
            'avg(messaging.message.receive.latency)',
            'count_op(queue.publish)',
            'count_op(queue.process)',
          ],
        }),
      })
    );
    await waitForElementToBeRemoved(() => screen.queryAllByTestId('loading-indicator'));
  });
});
