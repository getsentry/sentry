import {browserHistory} from 'react-router';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {act, render, screen, userEvent, within} from 'sentry-test/reactTestingLibrary';

import ProjectsStore from 'sentry/stores/projectsStore';
import TagStore from 'sentry/stores/tagStore';
import EventView from 'sentry/utils/discover/eventView';
import TableView from 'sentry/views/discover/table/tableView';

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

  function renderComponent(context, tableData, view) {
    return render(
      <TableView
        organization={context.organization}
        location={location}
        eventView={view}
        isLoading={false}
        projects={context.organization.projects}
        tableData={tableData}
        onChangeShowTags={onChangeShowTags}
      />,
      {context: context.routerContext}
    );
  }

  async function openContextMenu(cellIndex) {
    const firstRow = screen.getAllByRole('row')[1];
    const emptyValueCell = within(firstRow).getAllByRole('cell')[cellIndex];

    await userEvent.hover(within(emptyValueCell).getByTestId('cell-action-container'));
    await userEvent.click(within(emptyValueCell).getByRole('button'));
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
    act(() => {
      ProjectsStore.loadInitialData(initialData.organization.projects);
      TagStore.reset();
      TagStore.loadTagsSuccess([
        {name: 'size', key: 'size', count: 1},
        {name: 'shape', key: 'shape', count: 1},
        {name: 'direction', key: 'direction', count: 1},
      ]);
    });

    onChangeShowTags = jest.fn();

    rows = {
      meta: {
        title: 'string',
        transaction: 'string',
        'count()': 'integer',
        timestamp: 'date',
        release: 'string',
        'equation[0]': 'integer',
      },
      data: [
        {
          title: 'some title',
          transaction: '/organizations/',
          'count()': 9,
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

  it('updates sort order on equation fields', function () {
    const view = eventView.clone();
    renderComponent(initialData, rows, view);

    const equationCell = screen.getByRole('columnheader', {name: 'count() + 100'});
    const sortLink = within(equationCell).getByRole('link');

    expect(sortLink).toHaveAttribute(
      'href',
      '/organizations/org-slug/discover/results/?environment=staging&field=title&field=transaction&field=count%28%29&field=timestamp&field=release&field=equation%7Ccount%28%29%20%2B%20100&id=42&name=best%20query&project=123&query=&sort=-equation%7Ccount%28%29%20%2B%20100&statsPeriod=14d&yAxis=p95'
    );
  });

  it('updates sort order on non-equation fields', function () {
    const view = eventView.clone();
    renderComponent(initialData, rows, view);

    const transactionCell = screen.getByRole('columnheader', {name: 'transaction'});
    const sortLink = within(transactionCell).getByRole('link');

    expect(sortLink).toHaveAttribute(
      'href',
      '/organizations/org-slug/discover/results/?environment=staging&field=title&field=transaction&field=count%28%29&field=timestamp&field=release&field=equation%7Ccount%28%29%20%2B%20100&id=42&name=best%20query&project=123&query=&sort=-transaction&statsPeriod=14d&yAxis=p95'
    );
  });

  it('handles add cell action on null value', async function () {
    rows.data[0].title = null;

    renderComponent(initialData, rows, eventView);
    await openContextMenu(1);
    await userEvent.click(screen.getByRole('button', {name: 'Add to filter'}));

    expect(browserHistory.push).toHaveBeenCalledWith({
      pathname: location.pathname,
      query: expect.objectContaining({
        query: '!has:title',
      }),
    });
  });

  it('handles add cell action on null value replace has condition', async function () {
    rows.data[0].title = null;
    const view = eventView.clone();
    view.query = 'tag:value has:title';

    renderComponent(initialData, rows, view);
    await openContextMenu(1);
    await userEvent.click(screen.getByRole('button', {name: 'Add to filter'}));

    expect(browserHistory.push).toHaveBeenCalledWith({
      pathname: location.pathname,
      query: expect.objectContaining({
        query: 'tag:value !has:title',
      }),
    });
  });

  it('handles add cell action on string value replace negation', async function () {
    const view = eventView.clone();
    view.query = 'tag:value !title:nope';

    renderComponent(initialData, rows, view);
    await openContextMenu(1);
    await userEvent.click(screen.getByRole('button', {name: 'Add to filter'}));

    expect(browserHistory.push).toHaveBeenCalledWith({
      pathname: location.pathname,
      query: expect.objectContaining({
        query: 'tag:value title:"some title"',
      }),
    });
  });

  it('handles add cell action with multiple y axis', async function () {
    location.query.yAxis = ['count()', 'failure_count()'];

    renderComponent(initialData, rows, eventView);
    await openContextMenu(1);
    await userEvent.click(screen.getByRole('button', {name: 'Add to filter'}));

    expect(browserHistory.push).toHaveBeenCalledWith({
      pathname: location.pathname,
      query: expect.objectContaining({
        query: 'title:"some title"',
        yAxis: ['count()', 'failure_count()'],
      }),
    });
  });

  it('handles exclude cell action on string value', async function () {
    renderComponent(initialData, rows, eventView);
    await openContextMenu(1);
    await userEvent.click(screen.getByRole('button', {name: 'Exclude from filter'}));

    expect(browserHistory.push).toHaveBeenCalledWith({
      pathname: location.pathname,
      query: expect.objectContaining({
        query: '!title:"some title"',
      }),
    });
  });

  it('handles exclude cell action on string value replace inclusion', async function () {
    const view = eventView.clone();
    view.query = 'tag:value title:nope';

    renderComponent(initialData, rows, view);
    await openContextMenu(1);
    await userEvent.click(screen.getByRole('button', {name: 'Exclude from filter'}));

    expect(browserHistory.push).toHaveBeenCalledWith({
      pathname: location.pathname,
      query: expect.objectContaining({
        query: 'tag:value !title:"some title"',
      }),
    });
  });

  it('handles exclude cell action on null value', async function () {
    rows.data[0].title = null;

    renderComponent(initialData, rows, eventView);
    await openContextMenu(1);
    await userEvent.click(screen.getByRole('button', {name: 'Exclude from filter'}));

    expect(browserHistory.push).toHaveBeenCalledWith({
      pathname: location.pathname,
      query: expect.objectContaining({
        query: 'has:title',
      }),
    });
  });

  it('handles exclude cell action on null value replace condition', async function () {
    const view = eventView.clone();
    view.query = 'tag:value !has:title';
    rows.data[0].title = null;

    renderComponent(initialData, rows, view);
    await openContextMenu(1);
    await userEvent.click(screen.getByRole('button', {name: 'Exclude from filter'}));

    expect(browserHistory.push).toHaveBeenCalledWith({
      pathname: location.pathname,
      query: expect.objectContaining({
        query: 'tag:value has:title',
      }),
    });
  });

  it('handles greater than cell action on number value', async function () {
    renderComponent(initialData, rows, eventView);
    await openContextMenu(3);
    await userEvent.click(screen.getByRole('button', {name: 'Show values greater than'}));

    expect(browserHistory.push).toHaveBeenCalledWith({
      pathname: location.pathname,
      query: expect.objectContaining({
        query: 'count():>9',
      }),
    });
  });

  it('handles less than cell action on number value', async function () {
    renderComponent(initialData, rows, eventView);
    await openContextMenu(3);
    await userEvent.click(screen.getByRole('button', {name: 'Show values less than'}));

    expect(browserHistory.push).toHaveBeenCalledWith({
      pathname: location.pathname,
      query: expect.objectContaining({
        query: 'count():<9',
      }),
    });
  });

  it('handles go to transaction without project column selected', async function () {
    rows.data[0]['project.name'] = 'project-slug';

    renderComponent(initialData, rows, eventView);
    await openContextMenu(2);
    await userEvent.click(screen.getByRole('button', {name: 'Go to summary'}));

    expect(browserHistory.push).toHaveBeenCalledWith({
      pathname: '/organizations/org-slug/performance/summary/',
      query: expect.objectContaining({
        transaction: '/organizations/',
        project: ['2'],
      }),
    });
  });

  it('handles go to transaction with project column selected', async function () {
    rows.data[0].project = 'project-slug';

    renderComponent(initialData, rows, eventView);
    await openContextMenu(2);
    await userEvent.click(screen.getByRole('button', {name: 'Go to summary'}));

    expect(browserHistory.push).toHaveBeenCalledWith({
      pathname: '/organizations/org-slug/performance/summary/',
      query: expect.objectContaining({
        transaction: '/organizations/',
        project: ['2'],
      }),
    });
  });

  it('renders transaction summary link', function () {
    rows.data[0].project = 'project-slug';

    renderComponent(initialData, rows, eventView);

    const firstRow = screen.getAllByRole('row')[1];
    const link = within(firstRow).getByTestId('tableView-transaction-link');

    expect(link).toHaveAttribute(
      'href',
      expect.stringMatching(
        RegExp(
          '/organizations/org-slug/performance/summary/?.*project=2&referrer=performance-transaction-summary.*transaction=%2.*'
        )
      )
    );
  });

  it('handles go to release', async function () {
    renderComponent(initialData, rows, eventView);
    await openContextMenu(5);
    await userEvent.click(screen.getByRole('button', {name: 'Go to release'}));

    expect(browserHistory.push).toHaveBeenCalledWith({
      pathname: '/organizations/org-slug/releases/v1.0.2/',
      query: expect.objectContaining({
        environment: eventView.environment,
      }),
    });
  });

  it('has title on integer value greater than 999', function () {
    rows.data[0]['count()'] = 1000;
    renderComponent(initialData, rows, eventView);

    const firstRow = screen.getAllByRole('row')[1];
    const emptyValueCell = within(firstRow).getAllByRole('cell')[3];

    expect(within(emptyValueCell).getByText('1k')).toHaveAttribute('title', '1,000');
  });

  it('renders size columns correctly', function () {
    const orgWithFeature = TestStubs.Organization({
      projects: [TestStubs.Project()],
    });
    render(
      <TableView
        organization={orgWithFeature}
        location={location}
        eventView={EventView.fromLocation({
          ...location,
          query: {
            ...location.query,
            field: [
              'title',
              'p99(measurements.custom.kibibyte)',
              'p99(measurements.custom.kilobyte)',
            ],
          },
        })}
        isLoading={false}
        projects={initialData.organization.projects}
        tableData={{
          data: [
            {
              title: '/random/transaction/name',
              'p99(measurements.custom.kibibyte)': 222.3,
              'p99(measurements.custom.kilobyte)': 444.3,
            },
          ],
          meta: {
            title: 'string',
            'p99(measurements.custom.kibibyte)': 'size',
            'p99(measurements.custom.kilobyte)': 'size',
            units: {
              title: null,
              'p99(measurements.custom.kibibyte)': 'kibibyte',
              'p99(measurements.custom.kilobyte)': 'kilobyte',
            },
          },
        }}
        onChangeShowTags={onChangeShowTags}
      />
    );
    expect(screen.getByText('222.3 KiB')).toBeInTheDocument();
    expect(screen.getByText('444.3 KB')).toBeInTheDocument();
  });

  it('shows events with value less than selected custom performance metric', async function () {
    const orgWithFeature = TestStubs.Organization({
      projects: [TestStubs.Project()],
    });
    render(
      <TableView
        organization={orgWithFeature}
        location={location}
        eventView={EventView.fromLocation({
          ...location,
          query: {
            ...location.query,
            field: ['title', 'p99(measurements.custom.kilobyte)'],
          },
        })}
        isLoading={false}
        projects={initialData.organization.projects}
        tableData={{
          data: [
            {
              title: '/random/transaction/name',
              'p99(measurements.custom.kilobyte)': 444.3,
            },
          ],
          meta: {
            title: 'string',
            'p99(measurements.custom.kilobyte)': 'size',
            units: {
              title: null,
              'p99(measurements.custom.kilobyte)': 'kilobyte',
            },
          },
        }}
        onChangeShowTags={onChangeShowTags}
      />
    );
    await userEvent.hover(screen.getByText('444.3 KB'));
    const buttons = screen.getAllByRole('button');
    await userEvent.click(buttons[buttons.length - 1]);
    await userEvent.click(screen.getByText('Show values less than'));
    expect(browserHistory.push).toHaveBeenCalledWith({
      pathname: location.pathname,
      query: expect.objectContaining({
        query: 'p99(measurements.custom.kilobyte):<444300',
      }),
    });
  });
});
