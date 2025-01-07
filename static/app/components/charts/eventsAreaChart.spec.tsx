import {mockZoomRange} from 'sentry-test/charts';
import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen} from 'sentry-test/reactTestingLibrary';

import BaseChart from 'sentry/components/charts/baseChart';
import EventsChart from 'sentry/components/charts/eventsChart';

jest.mock('sentry/components/charts/baseChart', () => {
  return jest.fn().mockImplementation(() => <div data-test-id="area-chart" />);
});

describe('EventsChart with legend', function () {
  const {router, organization} = initializeOrg();

  beforeEach(function () {
    mockZoomRange(1543449600000, 1543708800000);
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/releases/`,
      body: [],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/releases/stats/`,
      body: [],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events-stats/`,
      method: 'GET',
      body: {
        data: [
          [1543449600, [20, 12]],
          [1543449601, [10, 5]],
        ],
      },
    });
  });

  it('renders a legend if enabled', async function () {
    render(
      <EventsChart
        api={new MockApiClient()}
        organization={organization}
        projects={[]}
        environments={[]}
        yAxis="count()"
        query=""
        period="14d"
        start={null}
        end={null}
        utc={false}
        router={router}
        showLegend
      />
    );
    expect(await screen.findByTestId('area-chart')).toBeInTheDocument();
    expect(jest.mocked(BaseChart).mock.calls[0]![0].legend).toHaveProperty('data');
  });
});
