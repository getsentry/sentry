import {LocationFixture} from 'sentry-fixture/locationFixture';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import {
  act,
  render,
  screen,
  userEvent,
  waitFor,
  within,
} from 'sentry-test/reactTestingLibrary';

import ProjectsStore from 'sentry/stores/projectsStore';
import TagStore from 'sentry/stores/tagStore';
import type {TableData} from 'sentry/utils/discover/discoverQuery';
import EventView from 'sentry/utils/discover/eventView';
import {SavedQueryDatasets} from 'sentry/utils/discover/types';
import TableView from 'sentry/views/discover/table/tableView';

describe('TableView > CellActions', () => {
  let rows: TableData;
  let onChangeShowTags: jest.Mock;

  const organization = OrganizationFixture({
    features: ['discover-basic'],
  });

  const projects = [ProjectFixture()];

  const locationQuery = {
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
    project: ['123'],
    statsPeriod: '14d',
    environment: ['staging'],
    yAxis: 'p95',
  };

  const location = LocationFixture({
    pathname: '/organizations/org-slug/explore/discover/results/',
    query: locationQuery,
  });

  const eventView = EventView.fromLocation(location);

  function renderComponent(tableData: TableData, view: EventView) {
    return render(
      <TableView
        organization={organization}
        location={location}
        eventView={view}
        isLoading={false}
        tableData={tableData}
        onChangeShowTags={onChangeShowTags}
        error={null}
        isFirstPage
        measurementKeys={null}
        showTags={false}
        title=""
        queryDataset={SavedQueryDatasets.TRANSACTIONS}
      />,
      {
        organization,
        initialRouterConfig: {
          location: {
            pathname: location.pathname,
            query: locationQuery,
          },
        },
      }
    );
  }

  async function openContextMenu(cellIndex: number) {
    const firstRow = screen.getAllByRole('row')[1]!;
    const emptyValueCell = within(firstRow).getAllByRole('cell')[cellIndex]!;

    await userEvent.click(within(emptyValueCell).getByRole('button', {name: 'Actions'}));
  }

  beforeEach(() => {
    act(() => {
      ProjectsStore.loadInitialData(projects);
      TagStore.reset();
      TagStore.loadTagsSuccess([
        {name: 'size', key: 'size'},
        {name: 'shape', key: 'shape'},
        {name: 'direction', key: 'direction'},
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
          id: '1',
          title: 'some title',
          transaction: '/organizations/',
          'count()': 9,
          timestamp: '2019-05-23T22:12:48+00:00',
          release: 'v1.0.2',
          'equation[0]': 109,
        },
      ],
    };

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/dynamic-sampling/custom-rules/',
      method: 'GET',
      statusCode: 204,
      body: '',
    });
  });

  afterEach(() => {
    ProjectsStore.reset();
  });

  it('updates sort order on equation fields', () => {
    const view = eventView.clone();
    renderComponent(rows, view);

    const equationCell = screen.getByRole('columnheader', {name: 'count() + 100'});
    const sortLink = within(equationCell).getByRole('link');

    expect(sortLink).toHaveAttribute(
      'href',
      '/organizations/org-slug/explore/discover/results/?environment=staging&field=title&field=transaction&field=count%28%29&field=timestamp&field=release&field=equation%7Ccount%28%29%20%2B%20100&id=42&name=best%20query&project=123&query=&queryDataset=transaction-like&sort=-equation%7Ccount%28%29%20%2B%20100&statsPeriod=14d&yAxis=p95'
    );
  });

  it('updates sort order on non-equation fields', () => {
    const view = eventView.clone();
    renderComponent(rows, view);

    const transactionCell = screen.getByRole('columnheader', {name: 'transaction'});
    const sortLink = within(transactionCell).getByRole('link');

    expect(sortLink).toHaveAttribute(
      'href',
      '/organizations/org-slug/explore/discover/results/?environment=staging&field=title&field=transaction&field=count%28%29&field=timestamp&field=release&field=equation%7Ccount%28%29%20%2B%20100&id=42&name=best%20query&project=123&query=&queryDataset=transaction-like&sort=-transaction&statsPeriod=14d&yAxis=p95'
    );
  });

  it('handles add cell action on null value', async () => {
    rows.data[0]!.title = null as any;

    const {router} = renderComponent(rows, eventView);
    await openContextMenu(1);
    await userEvent.click(screen.getByRole('menuitemradio', {name: 'Add to filter'}));

    await waitFor(() => {
      expect(router.location).toEqual(
        expect.objectContaining({
          pathname: location.pathname,
          query: expect.objectContaining({
            query: '!has:title',
          }),
        })
      );
    });
  });

  it('handles add cell action on null value replace has condition', async () => {
    rows.data[0]!.title = null as any;
    const view = eventView.clone();
    view.query = 'tag:value has:title';

    const {router} = renderComponent(rows, view);
    await openContextMenu(1);
    await userEvent.click(screen.getByRole('menuitemradio', {name: 'Add to filter'}));

    await waitFor(() => {
      expect(router.location).toEqual(
        expect.objectContaining({
          pathname: location.pathname,
          query: expect.objectContaining({
            query: 'tag:value !has:title',
          }),
        })
      );
    });
  });

  it('handles add cell action on string value replace negation', async () => {
    const view = eventView.clone();
    view.query = 'tag:value !title:nope';

    const {router} = renderComponent(rows, view);
    await openContextMenu(1);
    await userEvent.click(screen.getByRole('menuitemradio', {name: 'Add to filter'}));

    await waitFor(() => {
      expect(router.location).toEqual(
        expect.objectContaining({
          pathname: location.pathname,
          query: expect.objectContaining({
            query: 'tag:value title:"some title"',
          }),
        })
      );
    });
  });

  it('handles add cell action with multiple y axis', async () => {
    const multiYAxisQuery = {...locationQuery, yAxis: ['count()', 'failure_count()']};
    const multiYAxisLocation = LocationFixture({
      pathname: location.pathname,
      query: multiYAxisQuery,
    });
    const view = EventView.fromLocation(multiYAxisLocation);

    const {router} = render(
      <TableView
        organization={organization}
        location={multiYAxisLocation}
        eventView={view}
        isLoading={false}
        tableData={rows}
        onChangeShowTags={onChangeShowTags}
        error={null}
        isFirstPage
        measurementKeys={null}
        showTags={false}
        title=""
        queryDataset={SavedQueryDatasets.TRANSACTIONS}
      />,
      {
        organization,
        initialRouterConfig: {
          location: {
            pathname: location.pathname,
            query: multiYAxisQuery,
          },
        },
      }
    );

    await openContextMenu(1);
    await userEvent.click(screen.getByRole('menuitemradio', {name: 'Add to filter'}));

    await waitFor(() => {
      expect(router.location).toEqual(
        expect.objectContaining({
          pathname: location.pathname,
          query: expect.objectContaining({
            query: 'title:"some title"',
            yAxis: ['count()', 'failure_count()'],
          }),
        })
      );
    });
  });

  it('handles exclude cell action on string value', async () => {
    const {router} = renderComponent(rows, eventView);
    await openContextMenu(1);
    await userEvent.click(
      screen.getByRole('menuitemradio', {name: 'Exclude from filter'})
    );

    await waitFor(() => {
      expect(router.location).toEqual(
        expect.objectContaining({
          pathname: location.pathname,
          query: expect.objectContaining({
            query: '!title:"some title"',
          }),
        })
      );
    });
  });

  it('handles exclude cell action on string value replace inclusion', async () => {
    const view = eventView.clone();
    view.query = 'tag:value title:nope';

    const {router} = renderComponent(rows, view);
    await openContextMenu(1);
    await userEvent.click(
      screen.getByRole('menuitemradio', {name: 'Exclude from filter'})
    );

    await waitFor(() => {
      expect(router.location).toEqual(
        expect.objectContaining({
          pathname: location.pathname,
          query: expect.objectContaining({
            query: 'tag:value title:nope !title:"some title"',
          }),
        })
      );
    });
  });

  it('handles exclude cell action on null value', async () => {
    rows.data[0]!.title = null as any;

    const {router} = renderComponent(rows, eventView);
    await openContextMenu(1);
    await userEvent.click(
      screen.getByRole('menuitemradio', {name: 'Exclude from filter'})
    );

    await waitFor(() => {
      expect(router.location).toEqual(
        expect.objectContaining({
          pathname: location.pathname,
          query: expect.objectContaining({
            query: 'has:title',
          }),
        })
      );
    });
  });

  it('handles exclude cell action on null value replace condition', async () => {
    rows.data[0]!.title = null as any;
    const view = eventView.clone();
    view.query = 'tag:value !has:title';

    const {router} = renderComponent(rows, view);
    await openContextMenu(1);
    await userEvent.click(
      screen.getByRole('menuitemradio', {name: 'Exclude from filter'})
    );

    await waitFor(() => {
      expect(router.location).toEqual(
        expect.objectContaining({
          pathname: location.pathname,
          query: expect.objectContaining({
            query: 'tag:value has:title',
          }),
        })
      );
    });
  });

  it('handles greater than cell action on number value', async () => {
    const {router} = renderComponent(rows, eventView);
    await openContextMenu(3);
    await userEvent.click(
      screen.getByRole('menuitemradio', {name: 'Show values greater than'})
    );

    await waitFor(() => {
      expect(router.location).toEqual(
        expect.objectContaining({
          pathname: location.pathname,
          query: expect.objectContaining({
            query: 'count():>9',
          }),
        })
      );
    });
  });

  it('handles less than cell action on number value', async () => {
    const {router} = renderComponent(rows, eventView);
    await openContextMenu(3);
    await userEvent.click(
      screen.getByRole('menuitemradio', {name: 'Show values less than'})
    );

    await waitFor(() => {
      expect(router.location).toEqual(
        expect.objectContaining({
          pathname: location.pathname,
          query: expect.objectContaining({
            query: 'count():<9',
          }),
        })
      );
    });
  });

  it('renders transaction summary link', () => {
    rows.data[0]!.project = 'project-slug';

    renderComponent(rows, eventView);

    const firstRow = screen.getAllByRole('row')[1]!;
    const link = within(firstRow).getByTestId('tableView-transaction-link');

    expect(link).toHaveAttribute(
      'href',
      expect.stringMatching(
        new RegExp(
          '/organizations/org-slug/insights/summary/?.*project=2&referrer=performance-transaction-summary.*transaction=%2.*'
        )
      )
    );
  });

  it('renders trace view link', () => {
    const traceRows: TableData = {
      meta: {
        trace: 'string',
        id: 'string',
        transaction: 'string',
        timestamp: 'date',
        project: 'string',
      },
      data: [
        {
          trace: '7fdf8efed85a4f9092507063ced1995b',
          id: '509663014077465b8981b65225bdec0f',
          transaction: '/organizations/',
          timestamp: '2019-05-23T22:12:48+00:00',
          project: 'project-slug',
        },
      ],
    };

    const traceQuery = {
      id: '42',
      name: 'best query',
      field: ['id', 'transaction', 'timestamp'],
      queryDataset: 'transaction-like',
      sort: ['transaction'],
      query: '',
      project: ['123'],
      statsPeriod: '14d',
      environment: ['staging'],
      yAxis: 'p95',
    };

    const traceLocation = LocationFixture({
      pathname: '/organizations/org-slug/explore/discover/results/',
      query: traceQuery,
    });

    render(
      <TableView
        organization={organization}
        location={traceLocation}
        eventView={EventView.fromLocation(traceLocation)}
        isLoading={false}
        tableData={traceRows}
        onChangeShowTags={onChangeShowTags}
        error={null}
        isFirstPage
        measurementKeys={null}
        showTags={false}
        title=""
        queryDataset={SavedQueryDatasets.TRANSACTIONS}
      />,
      {
        organization,
        initialRouterConfig: {
          location: {
            pathname: traceLocation.pathname,
            query: traceQuery,
          },
        },
      }
    );

    const firstRow = screen.getAllByRole('row')[1]!;
    const link = within(firstRow).getByTestId('view-event');

    expect(link).toHaveAttribute(
      'href',
      expect.stringMatching(
        new RegExp(
          '/organizations/org-slug/explore/discover/trace/7fdf8efed85a4f9092507063ced1995b/?.*'
        )
      )
    );
  });

  it('handles go to release', async () => {
    const {router} = renderComponent(rows, eventView);
    await openContextMenu(5);
    await userEvent.click(screen.getByRole('menuitemradio', {name: 'Go to release'}));

    expect(eventView.environment).toHaveLength(1);
    expect(eventView.environment[0]).toBe('staging');

    await waitFor(() => {
      expect(router.location).toEqual(
        expect.objectContaining({
          pathname: '/organizations/org-slug/explore/releases/v1.0.2/',
          query: expect.objectContaining({
            environment: eventView.environment[0],
          }),
        })
      );
    });
  });

  it('has title on integer value greater than 999', () => {
    rows.data[0]!['count()'] = 1000;
    renderComponent(rows, eventView);

    const firstRow = screen.getAllByRole('row')[1]!;
    const emptyValueCell = within(firstRow).getAllByRole('cell')[3]!;

    expect(within(emptyValueCell).getByText('1k')).toHaveAttribute('title', '1,000');
  });

  it('renders size columns correctly', () => {
    const sizeQuery = {
      ...locationQuery,
      field: [
        'title',
        'p99(measurements.custom.kibibyte)',
        'p99(measurements.custom.kilobyte)',
      ],
    };
    const sizeLocation = LocationFixture({
      pathname: location.pathname,
      query: sizeQuery,
    });

    render(
      <TableView
        organization={organization}
        location={sizeLocation}
        eventView={EventView.fromLocation(sizeLocation)}
        isLoading={false}
        tableData={{
          data: [
            {
              id: '1',
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
              'p99(measurements.custom.kibibyte)': 'kibibyte',
              'p99(measurements.custom.kilobyte)': 'kilobyte',
            },
          },
        }}
        onChangeShowTags={onChangeShowTags}
        error={null}
        isFirstPage
        measurementKeys={null}
        showTags={false}
        title=""
      />,
      {
        organization,
        initialRouterConfig: {
          location: {
            pathname: location.pathname,
            query: sizeQuery,
          },
        },
      }
    );
    expect(screen.getByText('222.3 KiB')).toBeInTheDocument();
    expect(screen.getByText('444.3 KB')).toBeInTheDocument();
  });

  it('shows events with value less than selected custom performance metric', async () => {
    const metricQuery = {
      ...locationQuery,
      field: ['title', 'p99(measurements.custom.kilobyte)'],
    };
    const metricLocation = LocationFixture({
      pathname: location.pathname,
      query: metricQuery,
    });

    const {router} = render(
      <TableView
        organization={organization}
        location={metricLocation}
        eventView={EventView.fromLocation(metricLocation)}
        isLoading={false}
        tableData={{
          data: [
            {
              id: '1',
              title: '/random/transaction/name',
              'p99(measurements.custom.kilobyte)': 444.3,
            },
          ],
          meta: {
            title: 'string',
            'p99(measurements.custom.kilobyte)': 'size',
            units: {'p99(measurements.custom.kilobyte)': 'kilobyte'},
          },
        }}
        onChangeShowTags={onChangeShowTags}
        error={null}
        isFirstPage
        measurementKeys={null}
        showTags={false}
        title=""
      />,
      {
        organization,
        initialRouterConfig: {
          location: {
            pathname: location.pathname,
            query: metricQuery,
          },
        },
      }
    );
    await userEvent.hover(screen.getByText('444.3 KB'));
    const buttons = screen.getAllByRole('button');
    await userEvent.click(buttons[buttons.length - 1]!);
    await userEvent.click(screen.getByText('Show values less than'));

    await waitFor(() => {
      expect(router.location).toEqual(
        expect.objectContaining({
          pathname: location.pathname,
          query: expect.objectContaining({
            query: 'p99(measurements.custom.kilobyte):<444300',
          }),
        })
      );
    });
  });
});
