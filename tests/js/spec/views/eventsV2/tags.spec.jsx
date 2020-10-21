import {mount} from 'sentry-test/enzyme';
import {initializeOrg} from 'sentry-test/initializeOrg';

import {Client} from 'app/api';
import {Tags} from 'app/views/eventsV2/tags';
import EventView from 'app/utils/discover/eventView';

describe('Tags', function () {
  function generateUrl(key, value) {
    return `/endpoint/${key}/${value}`;
  }

  const org = TestStubs.Organization();
  beforeEach(function () {
    Client.addMockResponse({
      url: `/organizations/${org.slug}/events-facets/`,
      body: [
        {
          key: 'release',
          topValues: [{count: 2, value: 'abcd123', name: 'abcd123'}],
        },
        {
          key: 'environment',
          topValues: [{count: 2, value: 'abcd123', name: 'abcd123'}],
        },
        {
          key: 'color',
          topValues: [{count: 2, value: 'red', name: 'red'}],
        },
      ],
    });
  });

  afterEach(function () {
    Client.clearMockResponses();
  });

  it('renders', async function () {
    const api = new Client();

    const view = new EventView({
      fields: [],
      sorts: [],
      query: 'event.type:csp',
    });

    const wrapper = mount(
      <Tags
        eventView={view}
        api={api}
        totalValues={2}
        organization={org}
        selection={{projects: [], environments: [], datetime: {}}}
        location={{query: {}}}
        generateUrl={generateUrl}
        confirmedQuery={false}
      />
    );

    // component is in loading state
    expect(wrapper.find('StyledPlaceholder').length).toBeTruthy();

    await tick();
    wrapper.update();

    // component has loaded
    expect(wrapper.find('StyledPlaceholder')).toHaveLength(0);
  });

  it('creates URLs with generateUrl', async function () {
    const api = new Client();

    const view = new EventView({
      fields: [],
      sorts: [],
      query: 'event.type:csp',
    });

    const initialData = initializeOrg({
      organization: org,
      router: {
        location: {query: {}},
      },
    });

    const wrapper = mount(
      <Tags
        eventView={view}
        api={api}
        organization={org}
        totalValues={2}
        selection={{projects: [], environments: [], datetime: {}}}
        location={initialData.router.location}
        generateUrl={generateUrl}
        confirmedQuery={false}
      />,
      initialData.routerContext
    );

    // component is in loading state
    expect(wrapper.find('StyledPlaceholder').length).toBeTruthy();

    await tick();
    wrapper.update();

    // component has loaded
    expect(wrapper.find('StyledPlaceholder')).toHaveLength(0);

    const environmentFacetMap = wrapper
      .find('TagDistributionMeter')
      .filterWhere(component => component.props().title === 'environment')
      .first();

    const clickable = environmentFacetMap.find('Segment').first();

    clickable.simulate('click', {button: 0});

    await tick();
    wrapper.update();

    expect(initialData.router.push).toHaveBeenCalledWith('/endpoint/environment/abcd123');
  });
});
