import React from 'react';
import {mount} from 'enzyme';

import {initializeOrg} from 'app-test/helpers/initializeOrg';

import OrganizationIncidentsList from 'app/views/organizationIncidents/list';

describe('OrganizationIncidentsList', function() {
  const {routerContext} = initializeOrg();
  let mock;

  beforeEach(function() {
    mock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/incidents/',
      body: [
        TestStubs.Incident({id: '123', identifier: '1', title: 'First incident'}),
        TestStubs.Incident({id: '342', identifier: '2', title: 'Second incident'}),
      ],
    });
  });

  afterEach(function() {
    MockApiClient.clearMockResponses();
  });

  it('displays list', function() {
    const wrapper = mount(
      <OrganizationIncidentsList params={{orgId: 'org-slug'}} location={{query: {}}} />,
      TestStubs.routerContext()
    );

    const items = wrapper.find('PanelItem');

    expect(items).toHaveLength(2);
    expect(items.at(0).text()).toContain('First incident');
    expect(items.at(1).text()).toContain('Second incident');
  });

  it('displays empty state', function() {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/incidents/',
      body: [],
    });
    const wrapper = mount(
      <OrganizationIncidentsList params={{orgId: 'org-slug'}} location={{query: {}}} />,
      routerContext
    );
    expect(wrapper.find('PanelItem')).toHaveLength(0);
    expect(wrapper.text()).toContain("You don't have any incidents yet");
  });

  it('toggles all/unresolved', function() {
    const wrapper = mount(
      <OrganizationIncidentsList
        params={{orgId: 'org-slug'}}
        location={{query: {}, search: ''}}
      />,
      routerContext
    );

    expect(
      wrapper
        .find('.btn-group')
        .find('a')
        .at(0)
        .hasClass('active')
    ).toBe(true);

    expect(mock).toHaveBeenCalledTimes(1);

    expect(mock).toHaveBeenCalledWith(
      '/organizations/org-slug/incidents/',
      expect.objectContaining({query: {}})
    );

    wrapper.setProps({location: {query: {status: ''}, search: '?status='}});

    expect(
      wrapper
        .find('.btn-group')
        .find('Button')
        .at(1)
        .hasClass('active')
    ).toBe(true);

    expect(mock).toHaveBeenCalledTimes(2);

    expect(mock).toHaveBeenCalledWith(
      '/organizations/org-slug/incidents/',
      expect.objectContaining({query: expect.objectContaining({status: ''})})
    );
  });
});
