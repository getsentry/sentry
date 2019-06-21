import React from 'react';
import {mount} from 'enzyme';

import {Client} from 'app/api';
import {Tags} from 'app/views/organizationEventsV2/tags';

describe('Tags', function() {
  const org = TestStubs.Organization();
  beforeEach(function() {
    Client.addMockResponse({
      url: `/organizations/${org.slug}/events-heatmap/`,
      body: {
        key: 'release',
        name: 'Release',
        totalValues: 2,
        topValues: [{count: 2, value: 'abcd123', name: 'abcd123'}],
      },
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
    const view = {
      id: 'test',
      name: 'Test',
      data: {},
      tags: ['release', 'environment'],
    };
    const wrapper = mount(
      <Tags
        view={view}
        api={api}
        organization={org}
        selection={{projects: [], environments: [], datetime: {}}}
        location={{query: {}}}
      />
    );

    expect(wrapper.find('Placeholder')).toHaveLength(2);
    await tick();
    wrapper.update();
    expect(wrapper.find('Placeholder')).toHaveLength(0);
  });
});
