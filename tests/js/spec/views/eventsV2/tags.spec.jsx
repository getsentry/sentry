import React from 'react';
import {mount} from 'sentry-test/enzyme';

import {Client} from 'app/api';
import {Tags} from 'app/views/eventsV2/tags';
import EventView from 'app/views/eventsV2/eventView';
import {initializeOrg} from 'sentry-test/initializeOrg';

describe('Tags', function() {
  const org = TestStubs.Organization();
  beforeEach(function() {
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
      ],
    });

    Client.addMockResponse({
      url: `/organizations/${org.slug}/events-meta/`,
      body: {
        count: 2,
      },
    });
  });

  afterEach(function() {
    Client.clearMockResponses();
  });

  it('renders', async function() {
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
        organization={org}
        selection={{projects: [], environments: [], datetime: {}}}
        location={{query: {}}}
      />
    );

    // component is in loading state
    expect(wrapper.find('StyledPlaceholder').length).toBeTruthy();

    await tick();
    wrapper.update();

    // component has loaded
    expect(wrapper.find('StyledPlaceholder')).toHaveLength(0);
  });

  it('environment tag is a dedicated query string', async function() {
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
        selection={{projects: [], environments: [], datetime: {}}}
        location={initialData.router.location}
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
      .filterWhere(component => {
        return component.props().title === 'environment';
      })
      .first();

    const clickable = environmentFacetMap.find('Segment').first();

    clickable.simulate('click', {button: 0});

    await tick();
    wrapper.update();

    expect(initialData.router.push).toHaveBeenCalledWith({
      pathname: undefined,
      query: {environment: 'abcd123'},
    });
  });
});
