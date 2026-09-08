import {DeprecatedApiKeyFixture} from 'sentry-fixture/deprecatedApiKey';

import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

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

  it('updates the selected scopes', async () => {
    const updateRequest = MockApiClient.addMockResponse({
      url: `/organizations/org-slug/api-keys/${apiKey.id}/`,
      method: 'PUT',
      body: apiKey,
    });

    render(<OrganizationApiKeyDetails />, {
      initialRouterConfig: {
        location: {
          pathname: `/settings/org-slug/api-keys/${apiKey.id}/`,
        },
        route: '/settings/:orgId/api-keys/:apiKey/',
      },
    });

    await userEvent.click(await screen.findByRole('checkbox', {name: 'alerts:read'}));
    await userEvent.click(screen.getByRole('button', {name: 'Save Changes'}));

    await waitFor(() =>
      expect(updateRequest).toHaveBeenCalledWith(
        `/organizations/org-slug/api-keys/${apiKey.id}/`,
        expect.objectContaining({
          data: expect.objectContaining({
            scope_list: [...apiKey.scope_list, 'alerts:read'],
          }),
        })
      )
    );
  });

  it('preserves scopes unknown to the client when updating', async () => {
    const unknownScope = 'new-resource:read';
    const apiKeyWithUnknownScope = {
      ...apiKey,
      scope_list: [...apiKey.scope_list, unknownScope],
    };
    MockApiClient.addMockResponse({
      url: `/organizations/org-slug/api-keys/${apiKey.id}/`,
      method: 'GET',
      body: apiKeyWithUnknownScope,
    });
    const updateRequest = MockApiClient.addMockResponse({
      url: `/organizations/org-slug/api-keys/${apiKey.id}/`,
      method: 'PUT',
      body: apiKeyWithUnknownScope,
    });

    render(<OrganizationApiKeyDetails />, {
      initialRouterConfig: {
        location: {
          pathname: `/settings/org-slug/api-keys/${apiKey.id}/`,
        },
        route: '/settings/:orgId/api-keys/:apiKey/',
      },
    });

    await userEvent.click(await screen.findByRole('checkbox', {name: 'alerts:read'}));
    await userEvent.click(screen.getByRole('button', {name: 'Save Changes'}));

    await waitFor(() =>
      expect(updateRequest).toHaveBeenCalledWith(
        `/organizations/org-slug/api-keys/${apiKey.id}/`,
        expect.objectContaining({
          data: expect.objectContaining({
            scope_list: [...apiKeyWithUnknownScope.scope_list, 'alerts:read'],
          }),
        })
      )
    );
  });

  it('requires at least one scope', async () => {
    const updateRequest = MockApiClient.addMockResponse({
      url: `/organizations/org-slug/api-keys/${apiKey.id}/`,
      method: 'PUT',
      body: apiKey,
    });

    render(<OrganizationApiKeyDetails />, {
      initialRouterConfig: {
        location: {
          pathname: `/settings/org-slug/api-keys/${apiKey.id}/`,
        },
        route: '/settings/:orgId/api-keys/:apiKey/',
      },
    });

    await screen.findByRole('textbox', {name: 'API Key'});
    for (const checkbox of screen.getAllByRole('checkbox', {checked: true})) {
      await userEvent.click(checkbox);
    }
    await userEvent.click(screen.getByRole('button', {name: 'Save Changes'}));

    expect(await screen.findByText('At least one scope is required')).toBeInTheDocument();
    expect(updateRequest).not.toHaveBeenCalled();
  });
});
