import {act} from 'react-dom/test-utils';
import {browserHistory} from 'react-router';

import {selectDropdownMenuItem} from 'sentry-test/dropdownMenu';
import {mountWithTheme} from 'sentry-test/enzyme';
import {triggerPress} from 'sentry-test/utils';

import QueryList from 'sentry/views/eventsV2/queryList';

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
      />
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
        renderPrebuilt
        pageLinks=""
        onQueryChange={queryChangeMock}
        location={location}
      />
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
      />
    );
    const card = wrapper.find('QueryCard').last();
    expect(card.find('QueryCardContent').text()).toEqual(savedQueries[1].name);

    await selectDropdownMenuItem({
      wrapper,
      specifiers: {prefix: 'QueryCard', last: true},
      itemKey: 'duplicate',
    });

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
      />
    );
    const card = wrapper.find('QueryCard').last();
    expect(card.find('QueryCardContent').text()).toEqual(savedQueries[1].name);

    await selectDropdownMenuItem({
      wrapper,
      specifiers: {prefix: 'QueryCard', last: true},
      itemKey: 'delete',
    });

    expect(deleteMock).toHaveBeenCalled();
    expect(queryChangeMock).toHaveBeenCalled();
  });

  it('returns short url location for saved query', async function () {
    const wrapper = mountWithTheme(
      <QueryList
        organization={organization}
        savedQueries={savedQueries}
        pageLinks=""
        onQueryChange={queryChangeMock}
        location={location}
      />
    );
    const card = wrapper.find('QueryCard').last();
    const link = card.find('Link').last().prop('to');
    expect(link.pathname).toEqual('/organizations/org-slug/discover/results/');
    expect(link.query).toEqual({
      id: '2',
      statsPeriod: '14d',
    });
  });

  it('can redirect on last query deletion', async function () {
    const wrapper = mountWithTheme(
      <QueryList
        organization={organization}
        savedQueries={savedQueries.slice(1)}
        pageLinks=""
        onQueryChange={queryChangeMock}
        location={location}
      />
    );
    const card = wrapper.find('QueryCard').last();
    expect(card.find('QueryCardContent').text()).toEqual(savedQueries[1].name);

    await selectDropdownMenuItem({
      wrapper,
      specifiers: {prefix: 'QueryCard', last: true},
      itemKey: 'delete',
    });

    expect(deleteMock).toHaveBeenCalled();
    expect(queryChangeMock).not.toHaveBeenCalled();
    expect(browserHistory.push).toHaveBeenCalledWith({
      pathname: location.pathname,
      query: {cursor: undefined, statsPeriod: '14d'},
    });
  });

  it('renders Add to Dashboard in context menu with feature flag', async function () {
    const featuredOrganization = TestStubs.Organization({
      features: ['dashboards-edit'],
    });
    const wrapper = mountWithTheme(
      <QueryList
        organization={featuredOrganization}
        savedQueries={savedQueries.slice(1)}
        pageLinks=""
        onQueryChange={queryChangeMock}
        location={location}
      />
    );
    let card = wrapper.find('QueryCard').last();

    await act(async () => {
      triggerPress(card.find('DropdownTrigger'));

      await tick();
      wrapper.update();
    });

    card = wrapper.find('QueryCard').last();
    const menuItems = card.find('MenuItemWrap');

    expect(menuItems.length).toEqual(3);
    expect(menuItems.at(0).text()).toEqual('Add to Dashboard');
    expect(menuItems.at(1).text()).toEqual('Duplicate Query');
    expect(menuItems.at(2).text()).toEqual('Delete Query');
  });

  it('only renders Delete Query and Duplicate Query in context menu', async function () {
    const wrapper = mountWithTheme(
      <QueryList
        organization={organization}
        savedQueries={savedQueries.slice(1)}
        pageLinks=""
        onQueryChange={queryChangeMock}
        location={location}
      />
    );
    let card = wrapper.find('QueryCard').last();

    await act(async () => {
      triggerPress(card.find('DropdownTrigger'));

      await tick();
      wrapper.update();
    });

    card = wrapper.find('QueryCard').last();
    const menuItems = card.find('MenuItemWrap');

    expect(menuItems.length).toEqual(2);
    expect(menuItems.at(0).text()).toEqual('Duplicate Query');
    expect(menuItems.at(1).text()).toEqual('Delete Query');
  });

  it('passes yAxis from the savedQuery to MiniGraph', function () {
    const featuredOrganization = TestStubs.Organization({
      features: ['dashboards-edit'],
    });
    const yAxis = ['count()', 'failure_count()'];
    const savedQueryWithMultiYAxis = {
      ...savedQueries.slice(1)[0],
      yAxis,
    };
    const wrapper = mountWithTheme(
      <QueryList
        organization={featuredOrganization}
        savedQueries={[savedQueryWithMultiYAxis]}
        pageLinks=""
        onQueryChange={queryChangeMock}
        location={location}
      />
    );

    const miniGraph = wrapper.find('MiniGraph');
    expect(miniGraph.props().yAxis).toEqual(['count()', 'failure_count()']);
  });
});
