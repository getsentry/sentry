import React from 'react';
import {mount} from 'enzyme';
import {browserHistory} from 'react-router';

import {Client} from 'app/api';
import Discover2Item from 'app/components/sidebar/discover2Item';
import DiscoverSavedQueriesStore from 'app/stores/discoverSavedQueriesStore';

const makeWrapper = props =>
  mount(
    <Discover2Item {...props} label="Discover" icon="icon-search" />,
    TestStubs.routerContext()
  );

describe('Sidebar > Discover2Item', function() {
  let client, organization;
  beforeEach(function() {
    const now = new Date();
    Client.addMockResponse({
      url: '/organizations/org-slug/discover/saved/',
      body: [
        {
          id: '1',
          name: 'first query',
          fields: ['title', 'count()'],
          dateCreated: now,
          dateUpdated: now,
          createdBy: '1',
        },
        {
          id: '2',
          name: 'second query',
          fields: ['transaction', 'count()'],
          dateCreated: now,
          dateUpdated: now,
          createdBy: '1',
        },
      ],
    });
    client = new Client();
    organization = TestStubs.Organization();
  });

  afterEach(function() {
    DiscoverSavedQueriesStore.reset();
  });

  it('renders no menu when feature is off', async function() {
    const wrapper = makeWrapper({organization, client});
    // Wait for reflux
    await tick();

    const menu = wrapper.find('AutoComplete');
    expect(menu).toHaveLength(0);
  });

  it('renders a menu when feature is on', async function() {
    organization.features.push('discover-v2-query-builder');
    const wrapper = makeWrapper({organization, client});
    // Wait for reflux
    await tick();

    const menu = wrapper.find('AutoComplete');
    expect(menu).toHaveLength(1);
  });

  it('opens the menu', async function() {
    organization.features.push('discover-v2-query-builder');
    const wrapper = makeWrapper({organization, client});
    // Wait for reflux
    await tick();

    const nav = wrapper.find('nav');
    nav.simulate('mouseEnter');

    const menu = wrapper.find('Menu');
    expect(menu).toHaveLength(1);

    const menuItems = menu.find('MenuItem');
    expect(menuItems).toHaveLength(2);
  });

  it('handles delete buttons', async function() {
    const deleteRequest = Client.addMockResponse({
      url: '/organizations/org-slug/discover/saved/1/',
      method: 'DELETE',
    });
    organization.features.push('discover-v2-query-builder');
    const wrapper = makeWrapper({organization, client});
    // Wait for reflux
    await tick();

    const nav = wrapper.find('nav');
    nav.simulate('mouseEnter');
    await tick();

    const item = wrapper.find('Menu MenuItem').first();
    item.find('MenuItemButton[icon="icon-trash"]').simulate('click');

    expect(deleteRequest).toHaveBeenCalled();
  });

  it('handles edit buttons', async function() {
    organization.features.push('discover-v2-query-builder');
    const wrapper = makeWrapper({organization, client});
    // Wait for reflux
    await tick();

    const nav = wrapper.find('nav');
    nav.simulate('mouseEnter');
    await tick();

    const item = wrapper.find('Menu MenuItem').first();
    item.find('MenuItemButton[icon="icon-edit"]').simulate('click');
    expect(browserHistory.push).toHaveBeenCalled();
  });
});
