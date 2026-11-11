import {render, screen, waitFor} from 'sentry-test/reactTestingLibrary';

import {DiscoverQuery} from './discoverQuery';
import {EventView} from './eventView';

describe('DiscoverQuery', () => {
  let location: any, eventView: any;
  beforeEach(() => {
    location = {
      pathname: '/events',
      query: {},
    };
    eventView = EventView.fromSavedQuery({
      id: '',
      name: 'test query',
      version: 2,
      fields: ['transaction', 'count()'],
      projects: [1],
      environment: ['dev'],
    });
  });

  it('fetches data on mount', async () => {
    const getMock = MockApiClient.addMockResponse({
      url: '/organizations/test-org/events/',
      body: {
        meta: {fields: {transaction: 'string', count: 'number'}},
        data: [{transaction: '/health', count: 1000}],
      },
    });
    render(
      <DiscoverQuery orgSlug="test-org" location={location} eventView={eventView}>
        {({tableData, isLoading}) => {
          if (isLoading) {
            return 'loading';
          }
          return <p>{tableData?.data[0]!.transaction}</p>;
        }}
      </DiscoverQuery>
    );

    // Children should be rendered, and API should be called.
    await waitFor(() => expect(getMock).toHaveBeenCalledTimes(1));
    expect(await screen.findByText('/health')).toBeInTheDocument();
  });

  it('applies limit and cursor props', async () => {
    const getMock = MockApiClient.addMockResponse({
      url: '/organizations/test-org/events/',
      body: {
        meta: {fields: {transaction: 'string', count: 'number'}},
        data: [{transaction: '/health', count: 1000}],
      },
    });
    render(
      <DiscoverQuery
        orgSlug="test-org"
        location={location}
        eventView={eventView}
        limit={3}
        cursor="1:0:1"
      >
        {({tableData, isLoading}) => {
          if (isLoading) {
            return 'loading';
          }
          return <p>{tableData?.data[0]!.transaction}</p>;
        }}
      </DiscoverQuery>
    );

    await waitFor(() => expect(getMock).toHaveBeenCalledTimes(1));
    expect(getMock).toHaveBeenCalledWith(
      '/organizations/test-org/events/',
      expect.objectContaining({
        method: 'GET',
        query: expect.objectContaining({
          per_page: 3,
          cursor: '1:0:1',
        }),
      })
    );
  });

  it('reads the cursor from the location query when no cursor prop is passed', async () => {
    const getMock = MockApiClient.addMockResponse({
      url: '/organizations/test-org/events/',
      body: {meta: {fields: {}}, data: []},
    });

    render(
      <DiscoverQuery
        orgSlug="test-org"
        location={{...location, query: {cursor: '0:5:0'}}}
        eventView={eventView}
      >
        {() => null}
      </DiscoverQuery>
    );

    await waitFor(() =>
      expect(getMock).toHaveBeenCalledWith(
        '/organizations/test-org/events/',
        expect.objectContaining({query: expect.objectContaining({cursor: '0:5:0'})})
      )
    );
  });

  it('refetches when the cursor prop changes', async () => {
    const getMock = MockApiClient.addMockResponse({
      url: '/organizations/test-org/events/',
      body: {meta: {fields: {}}, data: []},
    });
    const renderQuery = (cursor: string) => (
      <DiscoverQuery
        orgSlug="test-org"
        location={location}
        eventView={eventView}
        cursor={cursor}
      >
        {() => null}
      </DiscoverQuery>
    );

    const {rerender} = render(renderQuery('0:0:0'));
    await waitFor(() => expect(getMock).toHaveBeenCalledTimes(1));
    rerender(renderQuery('0:5:0'));

    await waitFor(() => expect(getMock).toHaveBeenCalledTimes(2));
    expect(getMock).toHaveBeenLastCalledWith(
      '/organizations/test-org/events/',
      expect.objectContaining({query: expect.objectContaining({cursor: '0:5:0'})})
    );
  });

  it('does not refetch when rerendered with an equivalent payload', async () => {
    const getMock = MockApiClient.addMockResponse({
      url: '/organizations/test-org/events/',
      body: {
        meta: {fields: {transaction: 'string', count: 'number'}},
        data: [{transaction: '/health', count: 1000}],
      },
    });
    const renderQuery = () => (
      <DiscoverQuery
        orgSlug="test-org"
        location={{...location}}
        eventView={eventView.clone()}
      >
        {({tableData}) => <p>{tableData?.data[0]?.transaction}</p>}
      </DiscoverQuery>
    );

    const {rerender} = render(renderQuery());
    expect(await screen.findByText('/health')).toBeInTheDocument();
    rerender(renderQuery());

    expect(await screen.findByText('/health')).toBeInTheDocument();
    expect(getMock).toHaveBeenCalledTimes(1);
  });

  it('parses string errors correctly', async () => {
    MockApiClient.addMockResponse({
      url: '/organizations/test-org/events/',
      body: {
        detail: 'Error Message',
      },
      statusCode: 400,
    });

    let errorValue: any;
    render(
      <DiscoverQuery
        orgSlug="test-org"
        location={location}
        eventView={eventView}
        setError={e => (errorValue = e)}
      >
        {({isLoading}) => {
          if (isLoading) {
            return 'loading';
          }
          return null;
        }}
      </DiscoverQuery>
    );

    await waitFor(() => expect(errorValue.message).toBe('Error Message'));
  });

  it('parses object errors correctly', async () => {
    MockApiClient.addMockResponse({
      url: '/organizations/test-org/events/',
      body: {
        detail: {
          code: '?',
          message: 'Object Error',
          extra: {},
        },
      },
      statusCode: 400,
    });

    let errorValue: any;
    render(
      <DiscoverQuery
        orgSlug="test-org"
        location={location}
        eventView={eventView}
        setError={e => (errorValue = e)}
      >
        {({isLoading}) => {
          if (isLoading) {
            return 'loading';
          }
          return null;
        }}
      </DiscoverQuery>
    );

    await waitFor(() => expect(errorValue.message).toBe('Object Error'));
  });
});
