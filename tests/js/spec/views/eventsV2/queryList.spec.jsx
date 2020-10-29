import React from 'react';
import {browserHistory} from 'react-router';

import {mountWithTheme} from 'sentry-test/enzyme';

import QueryList from 'app/views/eventsV2/queryList';

function openContextMenu(card) {
  card.find('DropdownMenu MoreOptions svg').simulate('click');
}

function clickMenuItem(card, selector) {
  card.find(`DropdownMenu MenuItem[data-test-id="${selector}"]`).simulate('click');
}

describe('EventsV2 > QueryList', function () {
  let location, savedQueries, organization, deleteMock, duplicateMock, queryChangeMock;

  beforeEach(function () {
    organization = TestStubs.Organization();
    savedQueries = [
      TestStubs.DiscoverSavedQuery(),
      TestStubs.DiscoverSavedQuery({name: 'saved query 2', id: '2'}),
    ];

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events-stats/',
      method: 'GET',
      statusCode: 200,
      body: {data: []},
    });

    deleteMock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/discover/saved/2/',
      method: 'DELETE',
      statusCode: 200,
      body: {},
    });

    duplicateMock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/discover/saved/',
      method: 'POST',
      body: {
        id: '3',
        name: 'Saved query copy',
      },
    });

    location = {
      pathname: '/organizations/org-slug/discover/queries/',
      query: {cursor: '0:1:1', statsPeriod: '14d'},
    };
    queryChangeMock = jest.fn();
  });

  it('renders an empty list', function () {
    const wrapper = mountWithTheme(
      <QueryList
        organization={organization}
        savedQueries={[]}
        savedQuerySearchQuery="no matches"
        pageLinks=""
        onQueryChange={queryChangeMock}
        location={location}
      />,
      TestStubs.routerContext()
    );
    const content = wrapper.find('QueryCard');
    // No queries
    expect(content).toHaveLength(0);
    expect(wrapper.find('EmptyStateWarning')).toHaveLength(1);
  });

  it('renders pre-built queries and saved ones', function () {
    const wrapper = mountWithTheme(
      <QueryList
        organization={organization}
        savedQueries={savedQueries}
        pageLinks=""
        onQueryChange={queryChangeMock}
        location={location}
      />,
      TestStubs.routerContext()
    );
    const content = wrapper.find('QueryCard');
    // pre built + saved queries
    expect(content).toHaveLength(5);
  });

  it('can duplicate and trigger change callback', async function () {
    const wrapper = mountWithTheme(
      <QueryList
        organization={organization}
        savedQueries={savedQueries}
        pageLinks=""
        onQueryChange={queryChangeMock}
        location={location}
      />,
      TestStubs.routerContext()
    );
    let card = wrapper.find('QueryCard').last();
    expect(card.find('QueryCardContent').text()).toEqual(savedQueries[1].name);

    openContextMenu(card);
    wrapper.update();

    // Get a fresh node
    card = wrapper.find('QueryCard').last();
    clickMenuItem(card, 'duplicate-query');

    // wait for request
    await wrapper.update();

    expect(duplicateMock).toHaveBeenCalled();
    expect(queryChangeMock).toHaveBeenCalled();
  });

  it('can delete and trigger change callback', async function () {
    const wrapper = mountWithTheme(
      <QueryList
        organization={organization}
        savedQueries={savedQueries}
        pageLinks=""
        onQueryChange={queryChangeMock}
        location={location}
      />,
      TestStubs.routerContext()
    );
    let card = wrapper.find('QueryCard').last();
    expect(card.find('QueryCardContent').text()).toEqual(savedQueries[1].name);

    openContextMenu(card);
    wrapper.update();

    card = wrapper.find('QueryCard').last();
    clickMenuItem(card, 'delete-query');

    // wait for request
    await wrapper.update();

    expect(deleteMock).toHaveBeenCalled();
    expect(queryChangeMock).toHaveBeenCalled();
  });

  it('can redirect on last query deletion', async function () {
    const wrapper = mountWithTheme(
      <QueryList
        organization={organization}
        savedQueries={savedQueries.slice(1)}
        pageLinks=""
        onQueryChange={queryChangeMock}
        location={location}
      />,
      TestStubs.routerContext()
    );
    let card = wrapper.find('QueryCard').last();
    expect(card.find('QueryCardContent').text()).toEqual(savedQueries[1].name);

    // Open the context menu
    openContextMenu(card);
    wrapper.update();

    card = wrapper.find('QueryCard').last();
    clickMenuItem(card, 'delete-query');

    // wait for request
    await wrapper.update();

    expect(deleteMock).toHaveBeenCalled();
    expect(queryChangeMock).not.toHaveBeenCalled();
    expect(browserHistory.push).toHaveBeenCalledWith({
      pathname: location.pathname,
      query: {cursor: undefined, statsPeriod: '14d'},
    });
  });
});
