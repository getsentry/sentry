import {render} from 'sentry-test/reactTestingLibrary';

import OrganizationRepositoriesContainer from 'sentry/views/settings/organizationRepositories';

describe('OrganizationRepositoriesContainer', () => {
  beforeEach(() => {
    MockApiClient.clearMockResponses();
  });

  describe('without any providers', () => {
    beforeEach(() => {
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/repos/',
        body: [],
      });
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/config/repos/',
        body: {providers: []},
      });
    });

    it('is loading when initially rendering', () => {
      render(<OrganizationRepositoriesContainer />);
    });
  });
});
