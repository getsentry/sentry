import {Fragment} from 'react';

import {mountWithTheme} from 'sentry-test/enzyme';

import {Client} from 'app/api';
import TraceLiteQuery from 'app/utils/performance/quickTrace/traceLiteQuery';

const traceId = 'abcdef1234567890';
const eventId = '0987654321fedcba';

function renderTraceLite({isLoading, error, trace, type}) {
  if (isLoading) {
    return 'loading';
  } else if (error !== null) {
    return error;
  } else {
    return (
      <Fragment>
        <div key="type" data-test-id="type">
          {type}
        </div>
        <div key="trace" data-test-id="trace">
          {trace.length}
        </div>
      </Fragment>
    );
  }
}

describe('TraceLiteQuery', function () {
  let api, location;
  beforeEach(function () {
    api = new Client();
    location = {
      pathname: '/',
      query: {},
    };
  });

  it('fetches data on mount and passes the event id', async function () {
    const getMock = MockApiClient.addMockResponse(
      {
        url: `/organizations/test-org/events-trace-light/${traceId}/`,
        body: [],
      },
      {
        predicate: (_, {query}) => query.event_id === eventId,
      }
    );
    const wrapper = mountWithTheme(
      <TraceLiteQuery
        api={api}
        traceId={traceId}
        eventId={eventId}
        location={location}
        orgSlug="test-org"
        statsPeriod="24h"
      >
        {renderTraceLite}
      </TraceLiteQuery>
    );
    await tick();
    wrapper.update();

    expect(getMock).toHaveBeenCalledTimes(1);
    expect(wrapper.find('div[data-test-id="type"]').text()).toEqual('partial');
  });
});
