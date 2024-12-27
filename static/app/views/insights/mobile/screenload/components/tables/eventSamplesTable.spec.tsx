import {LocationFixture} from 'sentry-fixture/locationFixture';
import {RouterFixture} from 'sentry-fixture/routerFixture';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import type {InjectedRouter} from 'sentry/types/legacyReactRouter';
import type {NewQuery} from 'sentry/types/organization';
import EventView from 'sentry/utils/discover/eventView';
import {EventSamplesTable} from 'sentry/views/insights/mobile/screenload/components/tables/eventSamplesTable';

describe('EventSamplesTable', function () {
  let mockRouter: InjectedRouter;
  let mockLocation: ReturnType<typeof LocationFixture>;
  let mockQuery: NewQuery;
  let mockEventView: EventView;
  beforeEach(function () {
    mockRouter = RouterFixture();
    mockLocation = LocationFixture({
      query: {
        statsPeriod: '99d',
      },
    });

    mockQuery = {
      name: '',
      fields: ['transaction.id'],
      query: '',
      version: 2,
    };

    mockEventView = EventView.fromNewQueryWithLocation(mockQuery, mockLocation);
  });

  it('uses a column name map to render column names', function () {
    mockQuery = {
      name: '',
      fields: ['rawField'],
      query: '',
      version: 2,
    };
    mockEventView = EventView.fromNewQueryWithLocation(mockQuery, mockLocation);

    render(
      <EventSamplesTable
        columnNameMap={{
          rawField: 'Readable Column Name',
        }}
        cursorName=""
        eventIdKey="transaction.id"
        eventView={mockEventView}
        isLoading={false}
        profileIdKey="profile.id"
        sort={{
          field: '',
          kind: 'desc',
        }}
        sortKey=""
      />,
      {router: mockRouter}
    );

    expect(screen.getByText('Readable Column Name')).toBeInTheDocument();
    expect(screen.queryByText('rawField')).not.toBeInTheDocument();
  });

  it('uses the event ID key to get the event ID from the data payload', function () {
    mockQuery = {
      name: '',
      fields: ['transaction.id'],
      query: '',
      version: 2,
    };
    mockEventView = EventView.fromNewQueryWithLocation(mockQuery, mockLocation);

    render(
      <EventSamplesTable
        eventIdKey="transaction.id"
        columnNameMap={{'transaction.id': 'Event ID'}}
        cursorName=""
        eventView={mockEventView}
        isLoading={false}
        profileIdKey="profile.id"
        sort={{
          field: '',
          kind: 'desc',
        }}
        sortKey=""
        data={{data: [{id: '1', 'transaction.id': 'abc'}], meta: {}}}
      />,
      {router: mockRouter}
    );

    // Test only one column to isolate event ID
    expect(screen.getAllByRole('columnheader')).toHaveLength(1);
    expect(screen.getByRole('columnheader', {name: 'Event ID'})).toBeInTheDocument();
    expect(screen.getByText('abc')).toBeInTheDocument();
    expect(screen.queryByText('1')).not.toBeInTheDocument();
  });

  it('uses the profile ID key to get the profile ID from the data payload and display an icon button', async function () {
    mockQuery = {
      name: '',
      fields: ['profile.id', 'project.name'], // Project name is required to form the profile target
      query: '',
      version: 2,
    };
    mockEventView = EventView.fromNewQueryWithLocation(mockQuery, mockLocation);

    render(
      <EventSamplesTable
        profileIdKey="profile.id"
        columnNameMap={{'profile.id': 'Profile'}}
        eventIdKey="transaction.id"
        cursorName=""
        eventView={mockEventView}
        isLoading={false}
        sort={{
          field: '',
          kind: 'desc',
        }}
        sortKey=""
        data={{
          data: [{id: '1', 'profile.id': 'abc', 'project.name': 'project'}],
          meta: {fields: {'profile.id': 'string', 'project.name': 'string'}},
        }}
      />,
      {router: mockRouter}
    );

    // Test only one column to isolate profile column
    expect(screen.getAllByRole('columnheader')).toHaveLength(1);
    expect(screen.getByRole('columnheader', {name: 'Profile'})).toBeInTheDocument();
    expect(await screen.findByRole('button', {name: 'View Profile'})).toBeInTheDocument();
  });

  it('updates URL params when device class selector is changed', async function () {
    mockQuery = {
      name: '',
      fields: ['transaction.id'],
      query: '',
      version: 2,
    };
    mockEventView = EventView.fromNewQueryWithLocation(mockQuery, mockLocation);

    render(
      <EventSamplesTable
        showDeviceClassSelector
        eventIdKey="transaction.id"
        columnNameMap={{'transaction.id': 'Event ID'}}
        cursorName=""
        eventView={mockEventView}
        isLoading={false}
        profileIdKey="profile.id"
        sort={{
          field: '',
          kind: 'desc',
        }}
        sortKey=""
        data={{data: [{id: '1', 'transaction.id': 'abc'}], meta: {}}}
      />,
      {router: mockRouter}
    );

    expect(screen.getByRole('button', {name: /device class all/i})).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', {name: /device class all/i}));
    await userEvent.click(screen.getByText('Medium'));
    expect(mockRouter.push).toHaveBeenCalledWith(
      expect.objectContaining({
        pathname: '/mock-pathname/',
        query: expect.objectContaining({
          'device.class': 'medium',
        }),
      })
    );
  });

  it('updates URL params when the table is paginated', async function () {
    const pageLinks =
      '<https://sentry.io/fake/previous>; rel="previous"; results="false"; cursor="0:0:1", ' +
      '<https://sentry.io/fake/next>; rel="next"; results="true"; cursor="0:20:0"';
    render(
      <EventSamplesTable
        showDeviceClassSelector
        eventIdKey="transaction.id"
        columnNameMap={{'transaction.id': 'Event ID'}}
        cursorName="customCursorName"
        eventView={mockEventView}
        isLoading={false}
        profileIdKey="profile.id"
        sort={{
          field: '',
          kind: 'desc',
        }}
        sortKey=""
        data={{data: [{id: '1', 'transaction.id': 'abc'}], meta: {}}}
        pageLinks={pageLinks}
      />,
      {router: mockRouter}
    );
    expect(screen.getByRole('button', {name: 'Next'})).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', {name: 'Next'}));
    expect(mockRouter.push).toHaveBeenCalledWith(
      expect.objectContaining({
        pathname: '/mock-pathname/',
        query: expect.objectContaining({
          customCursorName: '0:20:0',
        }),
      })
    );
  });

  it('uses a custom sort key for sortable headers', async function () {
    mockQuery = {
      name: '',
      fields: ['transaction.id', 'duration'],
      query: '',
      version: 2,
    };

    mockEventView = EventView.fromNewQueryWithLocation(mockQuery, mockLocation);
    render(
      <EventSamplesTable
        showDeviceClassSelector
        eventIdKey="transaction.id"
        columnNameMap={{'transaction.id': 'Event ID', duration: 'Duration'}}
        cursorName="customCursorName"
        eventView={mockEventView}
        isLoading={false}
        profileIdKey="profile.id"
        sort={{
          field: 'transaction.id',
          kind: 'desc',
        }}
        sortKey="customSortKey"
        data={{data: [{id: '1', 'transaction.id': 'abc', duration: 'def'}], meta: {}}}
      />,
      {router: mockRouter}
    );

    // Ascending sort in transaction ID because the default is descending
    expect(await screen.findByRole('link', {name: 'Event ID'})).toHaveAttribute(
      'href',
      '/mock-pathname/?customSortKey=transaction.id'
    );
    expect(screen.getByRole('link', {name: 'Duration'})).toHaveAttribute(
      'href',
      '/mock-pathname/?customSortKey=-duration'
    );
  });

  it('only displays data for the columns defined in the name map', async function () {
    mockQuery = {
      name: '',
      fields: ['transaction.id', 'duration'],
      query: '',
      version: 2,
    };

    mockEventView = EventView.fromNewQueryWithLocation(mockQuery, mockLocation);
    render(
      <EventSamplesTable
        eventIdKey="transaction.id"
        columnNameMap={{duration: 'Duration'}}
        cursorName="customCursorName"
        eventView={mockEventView}
        isLoading={false}
        profileIdKey="profile.id"
        sort={{
          field: 'transaction.id',
          kind: 'desc',
        }}
        sortKey="customSortKey"
        data={{data: [{id: '1', 'transaction.id': 'abc', duration: 'def'}], meta: {}}}
      />,
      {router: mockRouter}
    );

    // Although ID is queried for, because it's not defined in the map
    // it isn't rendered
    expect(
      await screen.findByRole('columnheader', {name: 'Duration'})
    ).toBeInTheDocument();
    expect(screen.getAllByRole('columnheader')).toHaveLength(1);
  });
});
