import {Fragment} from 'react';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import TraceLiteQuery from 'sentry/utils/performance/quickTrace/traceLiteQuery';

const traceId = 'abcdef1234567890';
const eventId = '0987654321fedcba';

function renderTraceLite({isLoading, error, trace, type}) {
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
      <div key="trace" data-test-id="trace">
        {trace.length}
      </div>
    </Fragment>
  );
}

describe('TraceLiteQuery', function () {
  let location;
  beforeEach(function () {
    location = {
      pathname: '/',
      query: {},
    };
  });

  it('fetches data on mount and passes the event id', async function () {
    const getMock = MockApiClient.addMockResponse({
      url: `/organizations/test-org/events-trace-light/${traceId}/`,
      body: [],
      match: [MockApiClient.matchQuery({event_id: eventId})],
    });
    render(
      <TraceLiteQuery
        traceId={traceId}
        eventId={eventId}
        location={location}
        orgSlug="test-org"
        statsPeriod="24h"
      >
        {renderTraceLite}
      </TraceLiteQuery>
    );

    expect(await screen.findByText('partial')).toBeInTheDocument();
    expect(getMock).toHaveBeenCalledTimes(1);
  });
});
