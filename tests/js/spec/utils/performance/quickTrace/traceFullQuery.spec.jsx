import {Fragment} from 'react';

import {mountWithTheme} from 'sentry-test/enzyme';

import {Client} from 'app/api';
import {
  TraceFullDetailedQuery,
  TraceFullQuery,
} from 'app/utils/performance/quickTrace/traceFullQuery';

const traceId = 'abcdef1234567890';
const eventId = '0987654321fedcba';

function renderTraceFull({isLoading, error, type}) {
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
      </Fragment>
    );
  }
}

describe('TraceFullQuery', function () {
  let api, location;
  beforeEach(function () {
    api = new Client();
    location = {
      pathname: '/',
      query: {},
    };
  });

  it('fetches data on mount', async function () {
    const getMock = MockApiClient.addMockResponse({
      url: `/organizations/test-org/events-trace/${traceId}/`,
      body: [],
    });
    const wrapper = mountWithTheme(
      <TraceFullQuery
        api={api}
        traceId={traceId}
        eventId={eventId}
        location={location}
        orgSlug="test-org"
        statsPeriod="24h"
      >
        {renderTraceFull}
      </TraceFullQuery>
    );
    await tick();
    wrapper.update();

    expect(getMock).toHaveBeenCalledTimes(1);
    expect(wrapper.find('div[data-test-id="type"]').text()).toEqual('full');
  });

  it('fetches data on mount with detailed param', async function () {
    const getMock = MockApiClient.addMockResponse(
      {
        url: `/organizations/test-org/events-trace/${traceId}/`,
        body: [],
      },
      {
        predicate: (_, {query}) => query.detailed === '1',
      }
    );
    const wrapper = mountWithTheme(
      <TraceFullDetailedQuery
        api={api}
        traceId={traceId}
        eventId={eventId}
        location={location}
        orgSlug="test-org"
        statsPeriod="24h"
      >
        {renderTraceFull}
      </TraceFullDetailedQuery>
    );
    await tick();
    wrapper.update();

    expect(getMock).toHaveBeenCalledTimes(1);
    expect(wrapper.find('div[data-test-id="type"]').text()).toEqual('full');
  });
});
