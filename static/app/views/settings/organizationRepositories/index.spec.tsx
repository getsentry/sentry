import {Organization} from 'sentry-fixture/organization';

import {render} from 'sentry-test/reactTestingLibrary';

import OrganizationRepositoriesContainer from 'sentry/views/settings/organizationRepositories';

describe('OrganizationRepositoriesContainer', function () {
  const context = TestStubs.routerContext();
  const organization = Organization();
  const router = TestStubs.router();

  beforeEach(function () {
    MockApiClient.clearMockResponses();
  });

  describe('without any providers', function () {
    beforeEach(function () {
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/repos/',
        body: [],
      });
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/config/repos/',
        body: {providers: []},
      });
    });

    it('is loading when initially rendering', function () {
      render(
        <OrganizationRepositoriesContainer
          router={router}
          routes={router.routes}
          params={router.params}
          routeParams={router.params}
          route={router.routes[0]}
          location={router.location}
          organization={organization}
        />,
        {
          context,
        }
      );
    });
  });
});
