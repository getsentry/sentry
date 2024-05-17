import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen, waitForElementToBeRemoved} from 'sentry-test/reactTestingLibrary';

import useOrganization from 'sentry/utils/useOrganization';
import {LatencyChart} from 'sentry/views/performance/queues/charts/latencyChart';

jest.mock('sentry/utils/useOrganization');

describe('latencyChart', () => {
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
    render(<LatencyChart destination="events" />);
    screen.getByText('Avg Latency');
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
          query:
            'span.op:[queue.process,queue.publish] messaging.destination.name:events',
        }),
      })
    );
    await waitForElementToBeRemoved(() => screen.queryAllByTestId('loading-indicator'));
  });
});
