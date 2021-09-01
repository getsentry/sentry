import {Fragment} from 'react';

import {mountWithTheme} from 'sentry-test/enzyme';

import {Client} from 'app/api';
import QuickTraceQuery from 'app/utils/performance/quickTrace/quickTraceQuery';

const traceId = 'abcdef1234567890';
const eventId = '0987654321fedcba';

function renderQuickTrace({isLoading, error, trace, type}) {
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
  let api, location, event, traceLiteMock, traceFullMock, traceMetaMock;
  beforeEach(function () {
    api = new Client();
    location = {
      pathname: '/',
      query: {},
    };
    event = {
      id: eventId,
      contexts: {
        trace: {
          trace_id: traceId,
        },
      },
      type: 'transaction',
    };
    traceLiteMock = MockApiClient.addMockResponse(
      {
        url: `/organizations/test-org/events-trace-light/${traceId}/`,
        body: [],
      },
      {
        predicate: (_, {query}) => query.event_id === eventId,
      }
    );
    traceFullMock = MockApiClient.addMockResponse({
      url: `/organizations/test-org/events-trace/${traceId}/`,
      body: [],
    });
    traceMetaMock = MockApiClient.addMockResponse({
      url: `/organizations/test-org/events-trace-meta/${traceId}/`,
      body: {
        projects: 4,
        transactions: 5,
        errors: 2,
      },
    });
  });

  it('fetches data on mount and passes the event id', async function () {
    const wrapper = mountWithTheme(
      <QuickTraceQuery
        event={event}
        api={api}
        location={location}
        orgSlug="test-org"
        statsPeriod="24h"
      >
        {renderQuickTrace}
      </QuickTraceQuery>
    );
    await tick();
    wrapper.update();

    expect(traceLiteMock).toHaveBeenCalledTimes(1);
    expect(traceFullMock).toHaveBeenCalledTimes(1);
  });

  it('doesnt fetches meta when not needed', async function () {
    const wrapper = mountWithTheme(
      <QuickTraceQuery
        withMeta={false}
        event={event}
        api={api}
        location={location}
        orgSlug="test-org"
        statsPeriod="24h"
      >
        {renderQuickTrace}
      </QuickTraceQuery>
    );
    await tick();
    wrapper.update();

    expect(traceLiteMock).toHaveBeenCalledTimes(1);
    expect(traceFullMock).toHaveBeenCalledTimes(1);
    expect(traceMetaMock).toHaveBeenCalledTimes(0);
  });

  it('uses lite results when it cannot find current event in full results', async function () {
    const wrapper = mountWithTheme(
      <QuickTraceQuery
        withMeta={false}
        event={event}
        api={api}
        location={location}
        orgSlug="test-org"
        statsPeriod="24h"
      >
        {renderQuickTrace}
      </QuickTraceQuery>
    );
    await tick();
    wrapper.update();

    expect(wrapper.find('div[data-test-id="type"]').text()).toEqual('partial');
  });

  it('uses full results when it finds current event', async function () {
    traceLiteMock = MockApiClient.addMockResponse(
      {
        url: `/organizations/test-org/events-trace-light/0${traceId}/`,
        body: [],
      },
      {
        predicate: (_, {query}) => query.event_id === eventId,
      }
    );
    traceFullMock = MockApiClient.addMockResponse({
      url: `/organizations/test-org/events-trace/0${traceId}/`,
      body: [{event_id: eventId, children: []}],
    });
    traceMetaMock = MockApiClient.addMockResponse({
      url: `/organizations/test-org/events-trace-meta/0${traceId}/`,
      body: {
        projects: 4,
        transactions: 5,
        errors: 2,
      },
    });
    event.contexts.trace.trace_id = `0${traceId}`;
    const wrapper = mountWithTheme(
      <QuickTraceQuery
        withMeta={false}
        event={event}
        api={api}
        location={location}
        orgSlug="test-org"
        statsPeriod="24h"
      >
        {renderQuickTrace}
      </QuickTraceQuery>
    );
    await tick();
    wrapper.update();

    expect(wrapper.find('div[data-test-id="type"]').text()).toEqual('full');
  });
});
