import {Fragment} from 'react';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import {Client} from 'sentry/api';
import {
  TraceFullDetailedQuery,
  TraceFullQuery,
} from 'sentry/utils/performance/quickTrace/traceFullQuery';

const traceId = 'abcdef1234567890';
const eventId = '0987654321fedcba';

function renderTraceFull({isLoading, error, type}) {
  if (isLoading) {
    return 'loading';
  }
  if (error !== null) {
    return error;
  }
  return (
    <Fragment>
      <div key="type" data-test-id="type">
        {type}
      </div>
    </Fragment>
  );
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
    render(
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

    expect(await screen.findByTestId('type')).toHaveTextContent('full');
    expect(getMock).toHaveBeenCalledTimes(1);
  });

  it('fetches data on mount with detailed param', async function () {
    const getMock = MockApiClient.addMockResponse({
      url: `/organizations/test-org/events-trace/${traceId}/`,
      body: [],
      match: [MockApiClient.matchQuery({detailed: '1'})],
    });
    render(
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

    expect(await screen.findByTestId('type')).toHaveTextContent('full');
    expect(getMock).toHaveBeenCalledTimes(1);
  });
});
