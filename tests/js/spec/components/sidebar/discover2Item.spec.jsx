import React from 'react';
import {mountWithTheme} from 'sentry-test/enzyme';

import {Client} from 'app/api';
import Discover2Item from 'app/components/sidebar/discover2Item';
import DiscoverSavedQueriesStore from 'app/stores/discoverSavedQueriesStore';

const makeWrapper = props =>
  mountWithTheme(
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
          version: 2,
          name: 'first query',
          fields: ['title', 'count()'],
          dateCreated: now,
          dateUpdated: now,
          createdBy: '1',
        },
        {
          id: '2',
          name: 'second query',
          version: 2,
          fields: ['transaction', 'count()'],
          dateCreated: now,
          dateUpdated: now,
          createdBy: '1',
        },
        {
          id: '2',
          name: 'old query',
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

  it('renders no menu when closed', async function() {
    const wrapper = makeWrapper({organization, client});
    // Wait for reflux
    await tick();

    const menu = wrapper.find('AutoComplete');
    expect(menu).toHaveLength(0);
  });

  it('opens the menu on mouseEnter', async function() {
    const wrapper = makeWrapper({organization, client});
    // Wait for reflux
    await tick();
    await tick();

    const nav = wrapper.find('nav');
    nav.simulate('mouseEnter');
    await wrapper.update();

    const menu = wrapper.find('Menu');
    expect(menu).toHaveLength(1);

    // Old versionless items should be excluded
    const menuItems = menu.find('MenuItem');
    expect(menuItems).toHaveLength(2);
  });
});
