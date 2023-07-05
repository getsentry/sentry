import {render} from 'sentry-test/reactTestingLibrary';

import OrganizationRepositoriesContainer from 'sentry/views/settings/organizationRepositories';

describe('OrganizationRepositoriesContainer', function () {
  const context = TestStubs.routerContext();
  const organization = TestStubs.Organization();

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
      const wrapper = render(
        <OrganizationRepositoriesContainer organization={organization} />,
        {
          context,
        }
      );
      expect(wrapper.container).toSnapshot();
    });
  });
});
