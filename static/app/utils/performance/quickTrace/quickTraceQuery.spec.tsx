import {Fragment} from 'react';
import {Organization} from 'sentry-fixture/organization';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import QuickTraceQuery from 'sentry/utils/performance/quickTrace/quickTraceQuery';

const traceId = 'abcdef1234567890';
const eventId = '0987654321fedcba';

function renderQuickTrace({isLoading, error, trace, type}) {
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
  let location, event, traceLiteMock, traceFullMock, traceMetaMock;
  beforeEach(function () {
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
    traceLiteMock = MockApiClient.addMockResponse({
      url: `/organizations/test-org/events-trace-light/${traceId}/`,
      body: [],
      match: [MockApiClient.matchQuery({event_id: eventId})],
    });
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

  it('fetches data on mount and passes the event id', function () {
    render(
      <QuickTraceQuery event={event} location={location} orgSlug="test-org">
        {renderQuickTrace}
      </QuickTraceQuery>
    );

    expect(traceLiteMock).toHaveBeenCalledTimes(1);
    expect(traceFullMock).toHaveBeenCalledTimes(1);
  });

  it('doesnt fetch meta when not needed', function () {
    render(
      <QuickTraceQuery event={event} location={location} orgSlug="test-org">
        {renderQuickTrace}
      </QuickTraceQuery>
    );

    expect(traceLiteMock).toHaveBeenCalledTimes(1);
    expect(traceFullMock).toHaveBeenCalledTimes(1);
    expect(traceMetaMock).toHaveBeenCalledTimes(0);
  });

  it('uses lite results when it cannot find current event in full results', async function () {
    render(
      <QuickTraceQuery event={event} location={location} orgSlug="test-org">
        {renderQuickTrace}
      </QuickTraceQuery>
    );

    expect(await screen.findByTestId('type')).toHaveTextContent('partial');
  });

  it('uses full results when it finds current event', async function () {
    traceLiteMock = MockApiClient.addMockResponse({
      url: `/organizations/test-org/events-trace-light/0${traceId}/`,
      body: [],
      match: [MockApiClient.matchQuery({event_id: eventId})],
    });
    traceFullMock = MockApiClient.addMockResponse({
      url: `/organizations/test-org/events-trace/0${traceId}/`,
      body: {
        transactions: [{event_id: eventId, children: []}],
        orphan_errors: [],
      },
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

    render(
      <QuickTraceQuery event={event} location={location} orgSlug="test-org">
        {renderQuickTrace}
      </QuickTraceQuery>
    );

    expect(await screen.findByTestId('type')).toHaveTextContent('full');
  });

  it('uses trace full response with tracing without performance enabled', async function () {
    traceLiteMock = MockApiClient.addMockResponse({
      url: `/organizations/test-org/events-trace-light/0${traceId}/`,
      body: [],
      match: [MockApiClient.matchQuery({event_id: eventId})],
    });
    traceFullMock = MockApiClient.addMockResponse({
      url: `/organizations/test-org/events-trace/0${traceId}/`,
      body: {
        transactions: [{event_id: eventId, children: []}],
        orphan_errors: [],
      },
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

    const organization = Organization();
    organization.features = ['performance-tracing-without-performance'];

    render(
      <QuickTraceQuery event={event} location={location} orgSlug="test-org">
        {renderQuickTrace}
      </QuickTraceQuery>,
      {organization}
    );

    expect(await screen.findByTestId('type')).toHaveTextContent('full');
  });
});
