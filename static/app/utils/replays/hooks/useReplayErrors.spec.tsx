import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen} from 'sentry-test/reactTestingLibrary';

import useReplayErrors from 'sentry/utils/replays/hooks/useReplayErrors';
import {RouteContext} from 'sentry/views/routeContext';

function MockComponent(props) {
  const {data, isLoading, error} = useReplayErrors(props);

  if (isLoading) {
    return <div>Loading</div>;
  }
  if (error) {
    return <div>Error</div>;
  }

  return <div>{data}</div>;
}

const API_URL = `/organizations/org-slug/eventsv2/`;

describe('useReplayErrors', function () {
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
});
