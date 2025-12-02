import {DeprecatedApiKeyFixture} from 'sentry-fixture/deprecatedApiKey';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import OrganizationApiKeyDetails from 'sentry/views/settings/organizationApiKeys/organizationApiKeyDetails';

describe('OrganizationApiKeyDetails', () => {
  const apiKey = DeprecatedApiKeyFixture();
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
      initialRouterConfig: {
        location: {
          pathname: `/settings/org-slug/api-keys/${apiKey.id}/`,
        },
        route: '/settings/:orgId/api-keys/:apiKey/',
      },
    });

    expect(await screen.findByRole('textbox', {name: 'API Key'})).toBeInTheDocument();
    expect(screen.getByRole('textbox', {name: 'API Key'})).toHaveValue(apiKey.key);
  });
});
