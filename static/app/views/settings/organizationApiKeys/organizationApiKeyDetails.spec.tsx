import {DeprecatedApiKeyFixture} from 'sentry-fixture/deprecatedApiKey';
import {RouterFixture} from 'sentry-fixture/routerFixture';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import OrganizationApiKeyDetails from 'sentry/views/settings/organizationApiKeys/organizationApiKeyDetails';

describe('OrganizationApiKeyDetails', () => {
  const apiKey = DeprecatedApiKeyFixture();
  const router = RouterFixture({
    params: {
      apiKey: apiKey.id,
    },
  });
  beforeEach(() => {
    MockApiClient.clearMockResponses();
    MockApiClient.addMockResponse({
      url: `/organizations/org-slug/api-keys/${apiKey.id}/`,
      method: 'GET',
      body: apiKey,
    });
  });

  it('renders', async () => {
    render(<OrganizationApiKeyDetails />, {
      router,
      deprecatedRouterMocks: true,
    });

    expect(await screen.findByRole('textbox', {name: 'API Key'})).toBeInTheDocument();
    expect(screen.getByRole('textbox', {name: 'API Key'})).toHaveValue(apiKey.key);
  });
});
