import {mountWithTheme} from 'sentry-test/enzyme';
import {initializeOrg} from 'sentry-test/initializeOrg';

import EventView from 'sentry/utils/discover/eventView';
import MiniGraph from 'sentry/views/eventsV2/miniGraph';

jest.mock('sentry/components/charts/eventsGeoRequest', () =>
  jest.fn(({children}) =>
    children({
      errored: false,
      loading: false,
      reloading: false,
      tableData: [
        {
          data: [
            {
              'geo.country_code': 'PE',
              count: 9215,
            },
            {
              'geo.country_code': 'VI',
              count: 1,
            },
          ],
          meta: {
            'geo.country_code': 'string',
            count: 'integer',
          },
          title: 'Country',
        },
      ],
    })
  )
);

describe('EventsV2 > MiniGraph', function () {
  const features = ['discover-basic'];
  const location = TestStubs.location({
    query: {query: 'tag:value'},
    pathname: '/',
  });

  let organization, eventView, initialData;

  beforeEach(() => {
    organization = TestStubs.Organization({
      features,
      projects: [TestStubs.Project()],
    });
    initialData = initializeOrg({
      organization,
      router: {
        location,
      },
      project: 1,
      projects: [],
    });
    eventView = EventView.fromSavedQueryOrLocation(undefined, location);

    MockApiClient.clearMockResponses();
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events-stats/',
      statusCode: 200,
    });
  });

  it('makes an EventsRequest with all selected multi y axis', function () {
    const yAxis = ['count()', 'failure_count()'];
    const wrapper = mountWithTheme(
      <MiniGraph
        location={location}
        eventView={eventView}
        organization={organization}
        yAxis={yAxis}
      />,
      initialData.routerContext
    );
    const eventsRequestProps = wrapper.find('EventsRequest').props();
    expect(eventsRequestProps.yAxis).toEqual(yAxis);
  });

  it('uses low fidelity interval for bar charts', function () {
    const yAxis = ['count()', 'failure_count()'];
    eventView.display = 'bar';
    const wrapper = mountWithTheme(
      <MiniGraph
        location={location}
        eventView={eventView}
        organization={organization}
        yAxis={yAxis}
      />,
      initialData.routerContext
    );
    const eventsRequestProps = wrapper.find('EventsRequest').props();
    expect(eventsRequestProps.interval).toEqual('12h');
  });

  it('renders WorldMapChart', function () {
    const yAxis = ['count()', 'failure_count()'];
    eventView.display = 'worldmap';
    const wrapper = mountWithTheme(
      <MiniGraph
        location={location}
        eventView={eventView}
        organization={organization}
        yAxis={yAxis}
      />,
      initialData.routerContext
    );
    const worldMapChartProps = wrapper.find('WorldMapChart').props();
    expect(worldMapChartProps.series).toEqual([
      {
        data: [
          {name: 'PE', value: 9215},
          {name: 'VI', value: 1},
        ],
        seriesName: 'Country',
      },
    ]);
  });

  it('renders error message', async function () {
    const errorMessage = 'something went wrong';
    const api = new MockApiClient();
    MockApiClient.clearMockResponses();
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events-stats/',
      body: {
        detail: errorMessage,
      },
      statusCode: 400,
    });

    const wrapper = mountWithTheme(
      <MiniGraph
        location={location}
        eventView={eventView}
        organization={organization}
        api={api}
      />,
      initialData.routerContext
    );

    await tick();
    wrapper.update();

    expect(wrapper.find('MiniGraph').text()).toBe(errorMessage);
  });
});
