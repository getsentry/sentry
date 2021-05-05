import {Fragment} from 'react';

import {mountWithTheme} from 'sentry-test/enzyme';

import {Client} from 'app/api';
import TraceMetaQuery from 'app/utils/performance/quickTrace/traceMetaQuery';

const traceId = 'abcdef1234567890';

function renderMeta({isLoading, error, meta}) {
  if (isLoading) {
    return 'loading';
  } else if (error !== null) {
    return error;
  } else {
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
    const wrapper = mountWithTheme(
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
    await tick();
    wrapper.update();

    expect(getMock).toHaveBeenCalledTimes(1);
    expect(wrapper.find('div[data-test-id="projects"]').text()).toEqual('4');
    expect(wrapper.find('div[data-test-id="transactions"]').text()).toEqual('5');
    expect(wrapper.find('div[data-test-id="errors"]').text()).toEqual('2');
  });
});
