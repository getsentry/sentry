import {initializeOrg} from 'sentry-test/initializeOrg';
import {render} from 'sentry-test/reactTestingLibrary';

import OrganizationRepositoriesContainer from 'sentry/views/settings/organizationRepositories';

describe('OrganizationRepositoriesContainer', function () {
  const {routerContext} = initializeOrg();
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
      render(<OrganizationRepositoriesContainer />, {context: routerContext});
    });
  });
});
