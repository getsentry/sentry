import {mountWithTheme} from 'sentry-test/enzyme';
import {initializeOrg} from 'sentry-test/initializeOrg';

import EventView from 'app/utils/discover/eventView';
import MiniGraph from 'app/views/eventsV2/miniGraph';

describe('EventsV2 > MiniGraph', function () {
  const features = ['discover-basic', 'connect-discover-and-dashboards'];
  const location = {
    query: {query: 'tag:value'},
    pathname: '/',
  };

  let organization, eventView, initialData;

  beforeEach(() => {
    // @ts-expect-error
    organization = TestStubs.Organization({
      features,
      // @ts-expect-error
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
    // @ts-expect-error
    eventView = EventView.fromSavedQueryOrLocation(undefined, location);
  });

  it('makes an EventsRequest with all selected multi y axis', async function () {
    const yAxis = ['count()', 'failure_count()'];
    const wrapper = mountWithTheme(
      <MiniGraph
        // @ts-expect-error
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

  it('uses low fidelity interval for bar charts', async function () {
    const yAxis = ['count()', 'failure_count()'];
    eventView.display = 'bar';
    const wrapper = mountWithTheme(
      <MiniGraph
        // @ts-expect-error
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
});
