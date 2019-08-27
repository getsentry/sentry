import React from 'react';
import {mount} from 'enzyme';

import {Client} from 'app/api';
import {Tags} from 'app/views/organizationEventsV2/tags';
import EventView from 'app/views/organizationEventsV2/eventView';

describe('Tags', function() {
  const org = TestStubs.Organization();
  beforeEach(function() {
    Client.addMockResponse(
      {
        url: `/organizations/${org.slug}/events-distribution/`,
        body: {
          key: 'release',
          name: 'Release',
          totalValues: 2,
          topValues: [{count: 2, value: 'abcd123', name: 'abcd123'}],
        },
      },
      {
        predicate: (_, options) => {
          return options.query.key === 'release';
        },
      }
    );

    Client.addMockResponse(
      {
        url: `/organizations/${org.slug}/events-distribution/`,
        body: {
          key: 'environment',
          name: 'Environment',
          totalValues: 2,
          topValues: [{count: 2, value: 'abcd123', name: 'abcd123'}],
        },
      },
      {
        predicate: (_, options) => {
          return (
            options.query.key === 'environment' &&
            options.query.query === 'event.type:csp'
          );
        },
      }
    );

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
      tags: ['release', 'environment'],
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
    expect(wrapper.find('StyledPlaceholder')).toHaveLength(2);

    await tick();
    wrapper.update();

    // component has loaded
    expect(wrapper.find('StyledPlaceholder')).toHaveLength(0);
  });
});
