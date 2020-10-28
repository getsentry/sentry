import React from 'react';
import {browserHistory} from 'react-router';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {mountWithTheme} from 'sentry-test/enzyme';

import EventView from 'app/utils/discover/eventView';
import TableView from 'app/views/eventsV2/table/tableView';

describe('TableView > CellActions', function () {
  let initialData, rows, onChangeShowTags;

  const location = {
    pathname: '/organizations/org-slug/discover/results/',
    query: {
      id: '42',
      name: 'best query',
      field: ['title', 'transaction', 'count()', 'timestamp', 'release'],
      sort: ['title'],
      query: '',
      project: [123],
      statsPeriod: '14d',
      environment: ['staging'],
      yAxis: 'p95',
    },
  };
  const eventView = EventView.fromLocation(location);
  const tagKeys = ['size', 'shape', 'direction'];

  function makeWrapper(context, tableData, view) {
    return mountWithTheme(
      <TableView
        organization={context.organization}
        location={location}
        eventView={view}
        tagKeys={tagKeys}
        isLoading={false}
        projects={context.organization.projects}
        tableData={tableData}
        onChangeShowTags={onChangeShowTags}
      />,
      context.routerContext
    );
  }

  function openContextMenu(wrapper, cellIndex) {
    const menu = wrapper.find('CellAction').at(cellIndex);
    // Hover over the menu
    menu.find('Container > div').at(0).simulate('mouseEnter');
    wrapper.update();

    // Open the menu
    wrapper.find('MenuButton').simulate('click');

    // Return the menu wrapper so we can interact with it.
    return wrapper.find('CellAction').at(cellIndex).find('Menu');
  }

  beforeEach(function () {
    browserHistory.push.mockReset();

    const organization = TestStubs.Organization({
      features: ['discover-basic'],
      projects: [TestStubs.Project()],
    });

    initialData = initializeOrg({
      organization,
      router: {location},
    });

    onChangeShowTags = jest.fn();

    rows = {
      meta: {
        title: 'string',
        transaction: 'string',
        'count()': 'integer',
        timestamp: 'date',
        release: 'string',
      },
      data: [
        {
          title: 'some title',
          transaction: '/organizations/',
          count: 9,
          timestamp: '2019-05-23T22:12:48+00:00',
          release: 'v1.0.2',
        },
      ],
    };
  });

  it('handles add cell action on null value', function () {
    rows.data[0].title = null;

    const wrapper = makeWrapper(initialData, rows, eventView);
    const menu = openContextMenu(wrapper, 0);
    menu.find('button[data-test-id="add-to-filter"]').simulate('click');

    expect(browserHistory.push).toHaveBeenCalledWith({
      pathname: location.pathname,
      query: expect.objectContaining({
        query: '!has:title',
      }),
    });
  });

  it('handles add cell action on null value replace has condition', function () {
    rows.data[0].title = null;
    const view = eventView.clone();
    view.query = 'tag:value has:title';

    const wrapper = makeWrapper(initialData, rows, view);
    const menu = openContextMenu(wrapper, 0);
    menu.find('button[data-test-id="add-to-filter"]').simulate('click');

    expect(browserHistory.push).toHaveBeenCalledWith({
      pathname: location.pathname,
      query: expect.objectContaining({
        query: 'tag:value !has:title',
      }),
    });
  });

  it('handles add cell action on string value replace negation', function () {
    const view = eventView.clone();
    view.query = 'tag:value !title:nope';

    const wrapper = makeWrapper(initialData, rows, view);
    const menu = openContextMenu(wrapper, 0);
    menu.find('button[data-test-id="add-to-filter"]').simulate('click');

    expect(browserHistory.push).toHaveBeenCalledWith({
      pathname: location.pathname,
      query: expect.objectContaining({
        query: 'tag:value title:"some title"',
      }),
    });
  });

  it('handles exclude cell action on string value', function () {
    const wrapper = makeWrapper(initialData, rows, eventView);
    const menu = openContextMenu(wrapper, 0);
    menu.find('button[data-test-id="exclude-from-filter"]').simulate('click');

    expect(browserHistory.push).toHaveBeenCalledWith({
      pathname: location.pathname,
      query: expect.objectContaining({
        query: '!title:"some title"',
      }),
    });
  });

  it('handles exclude cell action on string value replace inclusion', function () {
    const view = eventView.clone();
    view.query = 'tag:value title:nope';

    const wrapper = makeWrapper(initialData, rows, view);
    const menu = openContextMenu(wrapper, 0);
    menu.find('button[data-test-id="exclude-from-filter"]').simulate('click');

    expect(browserHistory.push).toHaveBeenCalledWith({
      pathname: location.pathname,
      query: expect.objectContaining({
        query: 'tag:value !title:"some title"',
      }),
    });
  });

  it('handles exclude cell action on null value', function () {
    rows.data[0].title = null;

    const wrapper = makeWrapper(initialData, rows, eventView);
    const menu = openContextMenu(wrapper, 0);
    menu.find('button[data-test-id="exclude-from-filter"]').simulate('click');

    expect(browserHistory.push).toHaveBeenCalledWith({
      pathname: location.pathname,
      query: expect.objectContaining({
        query: 'has:title',
      }),
    });
  });

  it('handles exclude cell action on null value replace condition', function () {
    const view = eventView.clone();
    view.query = 'tag:value !has:title';
    rows.data[0].title = null;

    const wrapper = makeWrapper(initialData, rows, view);
    const menu = openContextMenu(wrapper, 0);
    menu.find('button[data-test-id="exclude-from-filter"]').simulate('click');

    expect(browserHistory.push).toHaveBeenCalledWith({
      pathname: location.pathname,
      query: expect.objectContaining({
        query: 'tag:value has:title',
      }),
    });
  });

  it('handles greater than cell action on number value', function () {
    const wrapper = makeWrapper(initialData, rows, eventView);
    const menu = openContextMenu(wrapper, 2);
    menu.find('button[data-test-id="show-values-greater-than"]').simulate('click');

    expect(browserHistory.push).toHaveBeenCalledWith({
      pathname: location.pathname,
      query: expect.objectContaining({
        query: 'count():>9',
      }),
    });
  });

  it('handles less than cell action on number value', function () {
    const wrapper = makeWrapper(initialData, rows, eventView);
    const menu = openContextMenu(wrapper, 2);
    menu.find('button[data-test-id="show-values-less-than"]').simulate('click');

    expect(browserHistory.push).toHaveBeenCalledWith({
      pathname: location.pathname,
      query: expect.objectContaining({
        query: 'count():<9',
      }),
    });
  });

  it('handles go to transaction', function () {
    const wrapper = makeWrapper(initialData, rows, eventView);
    const menu = openContextMenu(wrapper, 1);
    menu.find('button[data-test-id="transaction-summary"]').simulate('click');

    expect(browserHistory.push).toHaveBeenCalledWith({
      pathname: '/organizations/org-slug/performance/summary/',
      query: expect.objectContaining({
        transaction: '/organizations/',
      }),
    });
  });

  it('handles go to release', function () {
    const wrapper = makeWrapper(initialData, rows, eventView);
    const menu = openContextMenu(wrapper, 4);
    menu.find('button[data-test-id="release"]').simulate('click');

    expect(browserHistory.push).toHaveBeenCalledWith({
      pathname: '/organizations/org-slug/releases/v1.0.2/',
      query: expect.objectContaining({
        environment: eventView.environment,
      }),
    });
  });
});
