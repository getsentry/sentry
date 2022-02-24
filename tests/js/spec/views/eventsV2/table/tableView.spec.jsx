import {browserHistory} from 'react-router';

import {mountWithTheme} from 'sentry-test/enzyme';
import {initializeOrg} from 'sentry-test/initializeOrg';
import {act} from 'sentry-test/reactTestingLibrary';

import ProjectsStore from 'sentry/stores/projectsStore';
import EventView from 'sentry/utils/discover/eventView';
import TableView from 'sentry/views/eventsV2/table/tableView';

describe('TableView > CellActions', function () {
  let initialData, rows, onChangeShowTags;

  const location = {
    pathname: '/organizations/org-slug/discover/results/',
    query: {
      id: '42',
      name: 'best query',
      field: [
        'title',
        'transaction',
        'count()',
        'timestamp',
        'release',
        'equation|count() + 100',
      ],
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
    browserHistory.replace.mockReset();

    const organization = TestStubs.Organization({
      features: ['discover-basic'],
      projects: [TestStubs.Project()],
    });

    initialData = initializeOrg({
      organization,
      router: {location},
    });
    act(() => ProjectsStore.loadInitialData(initialData.organization.projects));

    onChangeShowTags = jest.fn();

    rows = {
      meta: {
        title: 'string',
        transaction: 'string',
        count: 'integer',
        timestamp: 'date',
        release: 'string',
        'equation[0]': 'integer',
      },
      data: [
        {
          title: 'some title',
          transaction: '/organizations/',
          count: 9,
          timestamp: '2019-05-23T22:12:48+00:00',
          release: 'v1.0.2',
          'equation[0]': 109,
        },
      ],
    };
  });

  afterEach(() => {
    ProjectsStore.reset();
  });

  it('updates sort order on equation fields', async function () {
    const view = eventView.clone();
    const wrapper = makeWrapper(initialData, rows, view);
    const equationSort = wrapper.find('SortLink').last();

    expect(equationSort.find('StyledTooltip').props().title).toBe('count() + 100');
    expect(equationSort.find('a').props().href).toBe(
      '/organizations/org-slug/discover/results/?environment=staging&field=title&field=transaction&field=count%28%29&field=timestamp&field=release&field=equation%7Ccount%28%29%20%2B%20100&id=42&name=best%20query&project=123&query=&sort=-equation%5B0%5D&statsPeriod=14d&yAxis=p95'
    );
  });

  it('updates sort order on non-equation fields', async function () {
    const view = eventView.clone();
    const wrapper = makeWrapper(initialData, rows, view);
    const equationSort = wrapper.find('SortLink').at(1);

    expect(equationSort.find('StyledTooltip').props().title).toBe('transaction');
    equationSort.simulate('click');

    expect(equationSort.find('a').props().href).toBe(
      '/organizations/org-slug/discover/results/?environment=staging&field=title&field=transaction&field=count%28%29&field=timestamp&field=release&field=equation%7Ccount%28%29%20%2B%20100&id=42&name=best%20query&project=123&query=&sort=-transaction&statsPeriod=14d&yAxis=p95'
    );
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

  it('handles add cell action with multiple y axis', function () {
    location.query.yAxis = ['count()', 'failure_count()'];
    const wrapper = makeWrapper(initialData, rows, eventView);
    const menu = openContextMenu(wrapper, 0);
    menu.find('button[data-test-id="add-to-filter"]').simulate('click');

    expect(browserHistory.push).toHaveBeenCalledWith({
      pathname: location.pathname,
      query: expect.objectContaining({
        query: 'title:"some title"',
        yAxis: ['count()', 'failure_count()'],
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

  it('handles go to transaction without project column selected', function () {
    rows.data[0]['project.name'] = 'project-slug';
    const wrapper = makeWrapper(initialData, rows, eventView);
    const menu = openContextMenu(wrapper, 1);
    menu.find('button[data-test-id="transaction-summary"]').simulate('click');

    expect(browserHistory.push).toHaveBeenCalledWith({
      pathname: '/organizations/org-slug/performance/summary/',
      query: expect.objectContaining({
        transaction: '/organizations/',
        project: ['2'],
      }),
    });
  });

  it('handles go to transaction with project column selected', function () {
    rows.data[0].project = 'project-slug';
    const wrapper = makeWrapper(initialData, rows, eventView);
    const menu = openContextMenu(wrapper, 1);
    menu.find('button[data-test-id="transaction-summary"]').simulate('click');

    expect(browserHistory.push).toHaveBeenCalledWith({
      pathname: '/organizations/org-slug/performance/summary/',
      query: expect.objectContaining({
        transaction: '/organizations/',
        project: ['2'],
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

  it('has tooltip on integer value greater than 999', function () {
    rows.data[0].count = 1000;
    const wrapper = makeWrapper(initialData, rows, eventView);
    const tooltip = wrapper.find('GridBody Tooltip').at(1);

    expect(wrapper.find('GridBody Tooltip').length).toEqual(3);
    expect(tooltip.prop('title')).toBe('1,000');
  });

  it('does not have tooltip on integer value less than 999', function () {
    const wrapper = makeWrapper(initialData, rows, eventView);
    expect(wrapper.find('GridBody Tooltip').length).toEqual(2);
  });
});
