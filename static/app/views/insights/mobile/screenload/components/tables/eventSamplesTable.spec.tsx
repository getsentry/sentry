import {LocationFixture} from 'sentry-fixture/locationFixture';

import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import type {NewQuery} from 'sentry/types/organization';
import EventView from 'sentry/utils/discover/eventView';
import {EventSamplesTable} from 'sentry/views/insights/mobile/screenload/components/tables/eventSamplesTable';

describe('EventSamplesTable', () => {
  const initialRouterConfig = {
    location: {
      pathname: '/organizations/org-slug/insights/mobile/screen-loads/',
      query: {
        statsPeriod: '99d',
      },
    },
    route: `/organizations/:orgId/insights/mobile/screen-loads/`,
  };

  const mockLocation = LocationFixture({
    pathname: initialRouterConfig.location.pathname,
    query: initialRouterConfig.location.query,
  });

  let mockQuery: NewQuery;
  let mockEventView: EventView;

  beforeEach(() => {
    mockQuery = {
      name: '',
      fields: ['transaction.id'],
      query: '',
      version: 2,
    };

    mockEventView = EventView.fromNewQueryWithLocation(mockQuery, mockLocation);

    MockApiClient.addMockResponse({
      url: `/organizations/org-slug/events/`,
      method: 'GET',
      match: [
        MockApiClient.matchQuery({
          referrer: 'api.insights.user-geo-subregion-selector',
        }),
      ],
      body: {
        data: [
          {'user.geo.subregion': '21', 'count()': 123},
          {'user.geo.subregion': '155', 'count()': 123},
        ],
        meta: {
          fields: {'user.geo.subregion': 'string', 'count()': 'integer'},
        },
      },
    });
  });

  it('uses a column name map to render column names', () => {
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
      {initialRouterConfig}
    );

    expect(screen.getByText('Readable Column Name')).toBeInTheDocument();
    expect(screen.queryByText('rawField')).not.toBeInTheDocument();
  });

  it('uses the event ID key to get the event ID from the data payload', () => {
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
      {initialRouterConfig}
    );

    // Test only one column to isolate event ID
    expect(screen.getAllByRole('columnheader')).toHaveLength(1);
    expect(screen.getByRole('columnheader', {name: 'Event ID'})).toBeInTheDocument();
    expect(screen.getByText('abc')).toBeInTheDocument();
    expect(screen.queryByText('1')).not.toBeInTheDocument();
  });

  it('uses the profile ID key to get the profile ID from the data payload and display an icon button', async () => {
    mockQuery = {
      name: '',
      fields: ['profile.id', 'project'], // Project name is required to form the profile target
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
          data: [{id: '1', 'profile.id': 'abc', project: 'project'}],
          meta: {fields: {'profile.id': 'string', project: 'string'}},
        }}
      />,
      {initialRouterConfig}
    );

    // Test only one column to isolate profile column
    expect(screen.getAllByRole('columnheader')).toHaveLength(1);
    expect(screen.getByRole('columnheader', {name: 'Profile'})).toBeInTheDocument();
    expect(await screen.findByRole('button', {name: 'View Profile'})).toBeInTheDocument();
  });

  it('updates URL params when the table is paginated', async () => {
    const pageLinks =
      '<https://sentry.io/fake/previous>; rel="previous"; results="false"; cursor="0:0:1", ' +
      '<https://sentry.io/fake/next>; rel="next"; results="true"; cursor="0:20:0"';
    const {router} = render(
      <EventSamplesTable
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
      {initialRouterConfig}
    );
    expect(screen.getByRole('button', {name: 'Next'})).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', {name: 'Next'}));
    await waitFor(() => {
      expect(router.location.query.customCursorName).toBe('0:20:0');
    });
  });

  it('uses a custom sort key for sortable headers', async () => {
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
      {initialRouterConfig}
    );

    // Ascending sort in transaction ID because the default is descending
    expect(await screen.findByRole('link', {name: 'Event ID'})).toHaveAttribute(
      'href',
      '/organizations/org-slug/insights/mobile/screen-loads/?customSortKey=transaction.id&statsPeriod=99d'
    );
    expect(screen.getByRole('link', {name: 'Duration'})).toHaveAttribute(
      'href',
      '/organizations/org-slug/insights/mobile/screen-loads/?customSortKey=-duration&statsPeriod=99d'
    );
  });

  it('only displays data for the columns defined in the name map', async () => {
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
      {initialRouterConfig}
    );

    // Although ID is queried for, because it's not defined in the map
    // it isn't rendered
    expect(
      await screen.findByRole('columnheader', {name: 'Duration'})
    ).toBeInTheDocument();
    expect(screen.getAllByRole('columnheader')).toHaveLength(1);
  });
});
