import {render, screen} from 'sentry-test/reactTestingLibrary';

import {Client} from 'sentry/api';
import DiscoverQuery from 'sentry/utils/discover/discoverQuery';
import EventView from 'sentry/utils/discover/eventView';

describe('DiscoverQuery', function () {
  let location, api, eventView;
  beforeEach(() => {
    api = new Client();
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

  it('fetches data on mount', async function () {
    const getMock = MockApiClient.addMockResponse({
      url: '/organizations/test-org/eventsv2/',
      body: {
        meta: {transaction: 'string', count: 'number'},
        data: [{transaction: '/health', count: 1000}],
      },
    });
    render(
      <DiscoverQuery
        orgSlug="test-org"
        api={api}
        location={location}
        eventView={eventView}
      >
        {({tableData, isLoading}) => {
          if (isLoading) {
            return 'loading';
          }
          return <p>{tableData.data[0].transaction}</p>;
        }}
      </DiscoverQuery>
    );
    await tick();

    // Children should be rendered, and API should be called.
    expect(getMock).toHaveBeenCalledTimes(1);
    expect(await screen.findByText('/health')).toBeInTheDocument();
  });

  it('applies limit and cursor props', async function () {
    const getMock = MockApiClient.addMockResponse({
      url: '/organizations/test-org/eventsv2/',
      body: {
        meta: {transaction: 'string', count: 'number'},
        data: [{transaction: '/health', count: 1000}],
      },
    });
    render(
      <DiscoverQuery
        orgSlug="test-org"
        api={api}
        location={location}
        eventView={eventView}
        limit={3}
        cursor="1:0:1"
      >
        {({tableData, isLoading}) => {
          if (isLoading) {
            return 'loading';
          }
          return <p>{tableData.data[0].transaction}</p>;
        }}
      </DiscoverQuery>
    );
    await tick();

    expect(getMock).toHaveBeenCalledTimes(1);
    expect(getMock).toHaveBeenCalledWith(
      '/organizations/test-org/eventsv2/',
      expect.objectContaining({
        method: 'GET',
        query: expect.objectContaining({
          per_page: 3,
          cursor: '1:0:1',
        }),
      })
    );
  });
});
