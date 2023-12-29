import {LocationFixture} from 'sentry-fixture/locationFixture';
import {RouterContextFixture} from 'sentry-fixture/routerContextFixture';
import {RouterFixture} from 'sentry-fixture/routerFixture';

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

    const router = RouterFixture({});
    render(
      <AccountAuthorizations
        location={LocationFixture()}
        routeParams={router.params}
        params={router.params}
        routes={router.routes}
        route={router.routes[0]}
        router={router}
      />,
      {
        context: RouterContextFixture(),
      }
    );
  });
});
