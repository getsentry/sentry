import {useMemo} from 'react';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen} from 'sentry-test/reactTestingLibrary';

import useDiscoverQuery from 'sentry/utils/replays/hooks/useDiscoveryQuery';
import {RouteContext} from 'sentry/views/routeContext';

function MockComponent({replayId, ...props}) {
  const discoverQuery = useMemo(
    () => ({
      query: `replayId:${replayId} AND event.type:error`,
      fields: ['event.id', 'error.value', 'timestamp', 'error.type', 'issue.id'],

      // environment and project shouldn't matter because having a replayId
      // assumes we have already filtered down to proper env/project
      environment: [],
      projects: [],
    }),
    [replayId]
  );
  const {data, isLoading, error} = useDiscoverQuery({
    discoverQuery,
    ...props,
  });

  if (isLoading) {
    return <div>Loading</div>;
  }
  if (error) {
    return <div>Error</div>;
  }

  return <div>{data}</div>;
}

function renderMock({props = {}, location = {}} = {}) {
  const {routerContext, router, organization} = initializeOrg();

  return render(
    <RouteContext.Provider
      value={{
        location: {...routerContext.context.location, ...location},
        router,
        params: {},
        routes: [],
      }}
    >
      <MockComponent replayId="1" {...props} />
    </RouteContext.Provider>,
    {context: routerContext, organization}
  );
}
const API_URL = `/organizations/org-slug/eventsv2/`;

describe('useDiscoverQuery', function () {
  let mockRequest: ReturnType<typeof MockApiClient.addMockResponse>;

  beforeAll(function () {
    mockRequest = MockApiClient.addMockResponse({
      url: API_URL,
      statusCode: 200,
      body: {data: 'success'},
    });
  });

  beforeEach(function () {
    mockRequest.mockReset();
  });

  it('makes a request', async function () {
    renderMock();

    await screen.findByText('success');

    expect(mockRequest).toHaveBeenCalledTimes(1);
    expect(mockRequest).toHaveBeenCalledWith(
      API_URL,
      expect.objectContaining({
        query: {
          environment: [],
          field: ['event.id', 'error.value', 'timestamp', 'error.type', 'issue.id'],
          per_page: 50,
          project: [],
          query: 'replayId:1 AND event.type:error',
          statsPeriod: '14d', // TODO: This will need to be changed
        },
      })
    );
  });

  it('makes a single request on multiple renders if replayId does not change', async function () {
    const {routerContext, router, organization} = initializeOrg();

    const location = {...routerContext.context.location};

    const {rerender} = render(
      <RouteContext.Provider value={{location, router, params: {}, routes: []}}>
        <MockComponent replayId="1" />
      </RouteContext.Provider>,
      {context: routerContext, organization}
    );

    await screen.findByText('success');
    expect(mockRequest).toHaveBeenCalledTimes(1);

    rerender(
      <RouteContext.Provider value={{location, router, params: {}, routes: []}}>
        <MockComponent replayId="1" />
      </RouteContext.Provider>
    );
    await screen.findByText('success');
    expect(mockRequest).toHaveBeenCalledTimes(1);
  });

  it('makes a new request when replayId changes', async function () {
    const {routerContext, router, organization} = initializeOrg();

    const location = {...routerContext.context.location};

    const {rerender} = render(
      <RouteContext.Provider value={{location, router, params: {}, routes: []}}>
        <MockComponent replayId="1" />
      </RouteContext.Provider>,
      {context: routerContext, organization}
    );

    await screen.findByText('success');
    expect(mockRequest).toHaveBeenCalledTimes(1);

    rerender(
      <RouteContext.Provider value={{location, router, params: {}, routes: []}}>
        <MockComponent replayId="2" />
      </RouteContext.Provider>
    );
    await screen.findByText('success');

    expect(mockRequest).toHaveBeenCalledTimes(2);
    expect(mockRequest).toHaveBeenLastCalledWith(
      API_URL,
      expect.objectContaining({
        query: {
          environment: [],
          field: ['event.id', 'error.value', 'timestamp', 'error.type', 'issue.id'],
          per_page: 50,
          project: [],
          query: 'replayId:2 AND event.type:error',
          statsPeriod: '14d',
        },
      })
    );
  });

  /**
   * Note we do not want this hook to use URL params because it is a discover
   * query depending on a parent query that requires the URL params. e.g. cursor is for the pagination of a parent query, but child cursor will needs its own
   */
  it('does not use current location params in request', async function () {
    renderMock({
      props: {
        ignoreCursor: true,
      },
      location: {
        query: {
          cursor: 'foo',
        },
      },
    });

    await screen.findByText('success');

    expect(mockRequest).toHaveBeenLastCalledWith(
      API_URL,
      expect.objectContaining({
        query: {
          environment: [],
          field: ['event.id', 'error.value', 'timestamp', 'error.type', 'issue.id'],
          per_page: 50,
          project: [],
          query: 'replayId:1 AND event.type:error',
          statsPeriod: '14d',
        },
      })
    );
  });
});
