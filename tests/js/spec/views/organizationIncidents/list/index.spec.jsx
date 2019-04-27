import React from 'react';
import {mount} from 'enzyme';

import {initializeOrg} from 'app-test/helpers/initializeOrg';

import OrganizationIncidentsList from 'app/views/organizationIncidents/list';

describe('OrganizationIncidentsList', function() {
  const {routerContext} = initializeOrg({
    projects: [TestStubs.Project()],
    router: {
      params: {orgId: 'org-slug'},
    },
  });

  afterEach(function() {
    MockApiClient.clearMockResponses();
  });

  it('displays list', function() {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/incidents/',
      body: [{id: '1', name: 'First incident'}, {id: '2', name: 'Second incident'}],
    });

    const wrapper = mount(<OrganizationIncidentsList />, routerContext);

    const items = wrapper.find('PanelItem');

    expect(items).toHaveLength(2);
    expect(items.at(0).text()).toBe('First incident');
    expect(items.at(1).text()).toBe('Second incident');
  });

  it('displays empty state', function() {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/incidents/',
      body: [],
    });
    const wrapper = mount(<OrganizationIncidentsList />, routerContext);
    expect(wrapper.find('PanelItem')).toHaveLength(0);
    expect(wrapper.text()).toContain("You don't have any incidents yet!");
  });
});
