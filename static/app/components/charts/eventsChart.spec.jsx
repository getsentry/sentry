import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen} from 'sentry-test/reactTestingLibrary';

import BaseChart from 'sentry/components/charts/baseChart';
import EventsChart from 'sentry/components/charts/eventsChart';
import {WorldMapChart} from 'sentry/components/charts/worldMapChart';

jest.mock('sentry/components/charts/baseChart', () => {
  return jest.fn().mockImplementation(() => <div data-test-id="chart" />);
});
jest.mock(
  'sentry/components/charts/eventsGeoRequest',
  () =>
    ({children}) =>
      children({
        errored: false,
        loading: false,
        reloading: false,
        tableData: [],
      })
);

describe('EventsChart', function () {
  const {router, routerContext, org} = initializeOrg();

  afterEach(() => {
    MockApiClient.clearMockResponses();
  });

  function renderChart(props) {
    return render(
      <EventsChart
        api={new MockApiClient()}
        location={{query: {}}}
        organization={org}
        project={[]}
        environment={[]}
        period="14d"
        start={null}
        end={null}
        utc={false}
        router={router}
        {...props}
      />,
      {context: routerContext}
    );
  }

  it('renders with World Map when given WorldMapChart chartComponent', async function () {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/releases/stats/',
      body: [],
    });
    renderChart({chartComponent: WorldMapChart, yAxis: ['count()']});
    expect(await screen.findByTestId('chart')).toBeInTheDocument();
    expect(BaseChart).toHaveBeenCalledWith(
      expect.objectContaining({
        series: [
          expect.objectContaining({
            map: 'sentryWorld',
          }),
        ],
      }),
      expect.anything()
    );
  });
});
