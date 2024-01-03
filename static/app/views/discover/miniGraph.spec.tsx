import {LocationFixture} from 'sentry-fixture/locationFixture';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {render} from 'sentry-test/reactTestingLibrary';

import * as eventRequest from 'sentry/components/charts/eventsRequest';
import EventView from 'sentry/utils/discover/eventView';
import MiniGraph from 'sentry/views/discover/miniGraph';

jest.mock('sentry/components/charts/eventsRequest');

describe('Discover > MiniGraph', function () {
  const features = ['discover-basic'];
  const location = LocationFixture({
    query: {query: 'tag:value'},
    pathname: '/',
  });

  let organization, eventView, initialData;

  beforeEach(() => {
    organization = OrganizationFixture({
      features,
      projects: [ProjectFixture()],
    });
    initialData = initializeOrg({
      organization,
      router: {
        location,
      },
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
});
