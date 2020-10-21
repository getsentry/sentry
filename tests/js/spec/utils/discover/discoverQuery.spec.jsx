import {mount} from 'sentry-test/enzyme';

import {Client} from 'app/api';
import EventView from 'app/utils/discover/eventView';
import DiscoverQuery from 'app/utils/discover/discoverQuery';

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
    const wrapper = mount(
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
    wrapper.update();

    // Children should be rendered, and API should be called.
    expect(getMock).toHaveBeenCalledTimes(1);
    expect(wrapper.find('p')).toHaveLength(1);
  });

  it('applies limit and cursor props', async function () {
    const getMock = MockApiClient.addMockResponse({
      url: '/organizations/test-org/eventsv2/',
      body: {
        meta: {transaction: 'string', count: 'number'},
        data: [{transaction: '/health', count: 1000}],
      },
    });
    const wrapper = mount(
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
    wrapper.update();

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
