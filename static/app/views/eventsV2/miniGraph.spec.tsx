import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, waitFor} from 'sentry-test/reactTestingLibrary';

import * as eventRequest from 'sentry/components/charts/eventsRequest';
import * as worldMaps from 'sentry/components/charts/worldMapChart';
import EventView from 'sentry/utils/discover/eventView';
import MiniGraph from 'sentry/views/eventsV2/miniGraph';

jest.mock('sentry/components/charts/eventsRequest');

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
    render(
      <MiniGraph
        location={location}
        eventView={eventView}
        organization={organization}
        yAxis={yAxis}
      />,
      {context: initialData.routerContext}
    );

    expect(eventRequest.default).toHaveBeenCalledWith(
      expect.objectContaining({yAxis}),
      expect.anything()
    );
  });

  it('uses low fidelity interval for bar charts', function () {
    const yAxis = ['count()', 'failure_count()'];
    eventView.display = 'bar';

    render(
      <MiniGraph
        location={location}
        eventView={eventView}
        organization={organization}
        yAxis={yAxis}
      />,
      {context: initialData.routerContext}
    );

    expect(eventRequest.default).toHaveBeenCalledWith(
      expect.objectContaining({interval: '12h'}),
      expect.anything()
    );
  });

  it('renders WorldMapChart', async function () {
    const yAxis = ['count()', 'failure_count()'];
    eventView.display = 'worldmap';

    jest.spyOn(worldMaps, 'WorldMapChart');

    render(
      <MiniGraph
        location={location}
        eventView={eventView}
        organization={organization}
        yAxis={yAxis}
      />,
      {context: initialData.routerContext}
    );

    await waitFor(() =>
      expect(worldMaps.WorldMapChart).toHaveBeenCalledWith(
        {
          height: 100,
          fromDiscoverQueryList: true,
          series: [
            {
              data: [
                {name: 'PE', value: 9215},
                {name: 'VI', value: 1},
              ],
              seriesName: 'Country',
            },
          ],
        },
        expect.anything()
      )
    );
  });
});
