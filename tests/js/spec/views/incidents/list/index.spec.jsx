import React from 'react';
import {mountWithTheme} from 'sentry-test/enzyme';

import {initializeOrg} from 'sentry-test/initializeOrg';

import IncidentsList from 'app/views/incidents/list';

describe('IncidentsList', function() {
  const {routerContext} = initializeOrg();
  let mock;
  let wrapper;

  const createWrapper = async props => {
    wrapper = mountWithTheme(
      <IncidentsList
        params={{orgId: 'org-slug'}}
        location={{query: {}, search: ''}}
        {...props}
      />,
      routerContext
    );
    // Wait for sparklines library
    await tick();
    wrapper.update();
    return wrapper;
  };

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

  it('displays list', async function() {
    wrapper = await createWrapper();

    const items = wrapper.find('IncidentPanelItem');

    expect(items).toHaveLength(2);
    expect(items.at(0).text()).toContain('First incident');
    expect(items.at(1).text()).toContain('Second incident');
  });

  it('displays empty state', async function() {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/incidents/',
      body: [],
    });

    wrapper = await createWrapper();
    expect(wrapper.find('PanelItem')).toHaveLength(0);
    expect(wrapper.text()).toContain("You don't have any Incidents yet");
  });

  it('toggles all/open', async function() {
    wrapper = await createWrapper();

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

    wrapper.setProps({location: {query: {status: 'open'}, search: '?status=open'}});

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
      expect.objectContaining({query: expect.objectContaining({status: 'open'})})
    );
  });
});
