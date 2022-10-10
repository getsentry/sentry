import {Fragment} from 'react';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import {Client} from 'sentry/api';
import TraceMetaQuery from 'sentry/utils/performance/quickTrace/traceMetaQuery';

const traceId = 'abcdef1234567890';

function renderMeta({isLoading, error, meta}) {
  if (isLoading) {
    return 'loading';
  }
  if (error !== null) {
    return error;
  }
  return (
    <Fragment>
      <div key="projects" data-test-id="projects">
        {meta.projects}
      </div>
      <div key="transactions" data-test-id="transactions">
        {meta.transactions}
      </div>
      <div key="errors" data-test-id="errors">
        {meta.errors}
      </div>
    </Fragment>
  );
}

describe('TraceMetaQuery', function () {
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
      url: `/organizations/test-org/events-trace-meta/${traceId}/`,
      body: {
        projects: 4,
        transactions: 5,
        errors: 2,
      },
    });
    render(
      <TraceMetaQuery
        api={api}
        traceId={traceId}
        location={location}
        orgSlug="test-org"
        statsPeriod="24h"
      >
        {renderMeta}
      </TraceMetaQuery>
    );

    expect(await screen.findByTestId('projects')).toHaveTextContent('4');
    expect(screen.getByTestId('transactions')).toHaveTextContent('5');
    expect(screen.getByTestId('errors')).toHaveTextContent('2');

    expect(getMock).toHaveBeenCalledTimes(1);
  });
});
