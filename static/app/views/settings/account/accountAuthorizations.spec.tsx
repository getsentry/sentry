import {render} from 'sentry-test/reactTestingLibrary';

import AccountAuthorizations from 'sentry/views/settings/account/accountAuthorizations';

describe('AccountAuthorizations', function () {
  beforeEach(function () {
    MockApiClient.clearMockResponses();
  });

  it('renders empty', function () {
    MockApiClient.addMockResponse({
      url: '/api-authorizations/',
      method: 'GET',
      body: [],
    });

    const router = TestStubs.router({});
    render(
      <AccountAuthorizations
        location={TestStubs.location()}
        routeParams={router.params}
        params={router.params}
        routes={router.routes}
        route={router.routes[0]}
        router={router}
      />,
      {
        context: TestStubs.routerContext(),
      }
    );
  });
});
