import {render, screen} from 'sentry-test/reactTestingLibrary';

import OrganizationApiKeyDetails from 'sentry/views/settings/organizationApiKeys/organizationApiKeyDetails';

describe('OrganizationApiKeyDetails', function () {
  beforeEach(function () {
    MockApiClient.clearMockResponses();
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/api-keys/1/',
      method: 'GET',
      body: TestStubs.ApiKey(),
    });
  });

  it('renders', function () {
    const wrapper = render(<OrganizationApiKeyDetails params={{apiKey: 1}} />, {
      context: TestStubs.routerContext(),
      organization: TestStubs.Organization(),
    });

    expect(screen.queryByTestId('loading-indicator')).not.toBeInTheDocument();
    expect(wrapper.container).toSnapshot();
  });
});
