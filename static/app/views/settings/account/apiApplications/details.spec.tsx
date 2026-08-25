import {
  render,
  renderGlobalModal,
  screen,
  userEvent,
} from 'sentry-test/reactTestingLibrary';

import ApiApplicationDetails from 'sentry/views/settings/account/apiApplications/details';

describe('ApiApplicationDetails', () => {
  const oauthBaseUrl = 'https://sentry-jest-tests.example.com/oauth';

  it('renders basic details for confidential client', async () => {
    MockApiClient.addMockResponse({
      url: '/api-applications/abcd/',
      body: {
        allowedOrigins: ['http://example.com'],
        clientID: 'abcd',
        clientSecret: '1234',
        homepageUrl: 'http://example.com/homepage',
        id: 'abcd',
        isPublic: false,
        name: 'Example App Name',
        privacyUrl: 'http://example.com/privacy',
        redirectUris: ['http://example.com/redirect'],
        termsUrl: ['http://example.com/terms'],
      },
    });

    render(<ApiApplicationDetails />, {
      initialRouterConfig: {
        route: '/settings/account/api-applications/:appId/',
        location: {
          pathname: '/settings/account/api-applications/abcd/',
        },
      },
    });

    expect(await screen.findByDisplayValue('http://example.com')).toBeInTheDocument();
    expect(screen.getByDisplayValue('http://example.com/redirect')).toBeInTheDocument();
    expect(screen.getByDisplayValue('http://example.com/privacy')).toBeInTheDocument();
    expect(screen.getByDisplayValue('http://example.com/terms')).toBeInTheDocument();
    expect(screen.getByDisplayValue('abcd')).toBeInTheDocument();
    expect(screen.getByDisplayValue('1234')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Example App Name')).toBeInTheDocument();

    expect(screen.getByLabelText('Name')).toBeInTheDocument();
    expect(screen.getByLabelText('Homepage')).toBeInTheDocument();
    expect(screen.getByLabelText('Privacy Policy')).toBeInTheDocument();
    expect(screen.getByLabelText('Terms of Service')).toBeInTheDocument();
    expect(screen.getByLabelText('Authorized Redirect URIs')).toBeInTheDocument();
    expect(screen.getByLabelText('Authorized JavaScript Origins')).toBeInTheDocument();
    expect(screen.getByLabelText('Client ID')).toBeInTheDocument();
    expect(screen.getByLabelText('Client Secret')).toBeInTheDocument();
    expect(screen.getByLabelText('Authorization URL')).toBeInTheDocument();
    expect(screen.getByLabelText('Token URL')).toBeInTheDocument();
    expect(screen.getByDisplayValue(`${oauthBaseUrl}/authorize/`)).toBeInTheDocument();
    expect(screen.getByDisplayValue(`${oauthBaseUrl}/token/`)).toBeInTheDocument();
    expect(screen.queryByLabelText('Device Authorization URL')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Device Verification URL')).not.toBeInTheDocument();
  });

  it('renders applications with optional URL fields unset', async () => {
    MockApiClient.addMockResponse({
      url: '/api-applications/legacy-app/',
      body: {
        allowedOrigins: [],
        clientID: 'legacy-app',
        clientSecret: null,
        homepageUrl: null,
        id: 'legacy-app',
        isPublic: false,
        name: 'Legacy App',
        privacyUrl: null,
        redirectUris: [],
        termsUrl: null,
      },
    });

    render(<ApiApplicationDetails />, {
      initialRouterConfig: {
        route: '/settings/account/api-applications/:appId/',
        location: {
          pathname: '/settings/account/api-applications/legacy-app/',
        },
      },
    });

    expect(await screen.findByDisplayValue('Legacy App')).toBeInTheDocument();
    expect(screen.getByLabelText('Homepage')).toHaveValue('');
    expect(screen.getByLabelText('Privacy Policy')).toHaveValue('');
    expect(screen.getByLabelText('Terms of Service')).toHaveValue('');
    expect(screen.getByLabelText('Authorized Redirect URIs')).toHaveValue('');
    expect(screen.getByLabelText('Authorized JavaScript Origins')).toHaveValue('');
  });

  it('handles client secret rotation', async () => {
    MockApiClient.addMockResponse({
      url: '/api-applications/abcd/',
      body: {
        allowedOrigins: ['http://example.com'],
        clientID: 'abcd',
        clientSecret: null,
        homepageUrl: 'http://example.com/homepage',
        id: 'abcd',
        isPublic: false,
        name: 'Example App Name',
        privacyUrl: 'http://example.com/privacy',
        redirectUris: ['http://example.com/redirect'],
        termsUrl: ['http://example.com/terms'],
      },
    });
    const rotateSecretApiCall = MockApiClient.addMockResponse({
      method: 'POST',
      url: '/api-applications/abcd/rotate-secret/',
      body: {
        clientSecret: 'newSecret!',
      },
    });

    render(<ApiApplicationDetails />, {
      initialRouterConfig: {
        route: '/settings/account/api-applications/:appId/',
        location: {
          pathname: '/settings/account/api-applications/abcd/',
        },
      },
    });
    renderGlobalModal();

    expect(await screen.findByText('hidden')).toBeInTheDocument();
    expect(
      screen.getByRole('button', {name: 'Rotate client secret'})
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', {name: 'Rotate client secret'}));
    // Confirm modal
    await userEvent.click(screen.getByRole('button', {name: 'Confirm'}));

    expect(
      screen.getByText('This will be the only time your client secret is visible!')
    ).toBeInTheDocument();
    expect(screen.getByText('Your new Client Secret')).toBeInTheDocument();
    expect(screen.getByLabelText<HTMLInputElement>('new-client-secret')).toHaveValue(
      'newSecret!'
    );

    expect(rotateSecretApiCall).toHaveBeenCalledTimes(1);
  });

  it('renders public client without client secret section', async () => {
    MockApiClient.addMockResponse({
      url: '/api-applications/public-app/',
      body: {
        allowedOrigins: ['http://example.com'],
        clientID: 'public-app',
        clientSecret: null,
        homepageUrl: 'http://example.com/homepage',
        id: 'public-app',
        isPublic: true,
        name: 'Public CLI App',
        privacyUrl: 'http://example.com/privacy',
        redirectUris: ['http://example.com/redirect'],
        termsUrl: ['http://example.com/terms'],
      },
    });

    render(<ApiApplicationDetails />, {
      initialRouterConfig: {
        route: '/settings/account/api-applications/:appId/',
        location: {
          pathname: '/settings/account/api-applications/public-app/',
        },
      },
    });

    // Should show public client tag
    expect(await screen.findByText('Public Client')).toBeInTheDocument();

    // Should show info alert about public clients
    expect(
      screen.getByText(/This is a public client, designed for CLIs/)
    ).toBeInTheDocument();

    // Should NOT show client secret field
    expect(screen.queryByLabelText('Client Secret')).not.toBeInTheDocument();

    // Should NOT show rotate button
    expect(
      screen.queryByRole('button', {name: 'Rotate client secret'})
    ).not.toBeInTheDocument();

    // Should still show other fields
    expect(screen.getByLabelText('Client ID')).toBeInTheDocument();
    expect(screen.getByDisplayValue('public-app')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Public CLI App')).toBeInTheDocument();
    expect(screen.getByDisplayValue(`${oauthBaseUrl}/authorize/`)).toBeInTheDocument();
    expect(screen.getByDisplayValue(`${oauthBaseUrl}/token/`)).toBeInTheDocument();
    expect(screen.getByDisplayValue(`${oauthBaseUrl}/device/code/`)).toBeInTheDocument();
    expect(screen.getByDisplayValue(`${oauthBaseUrl}/device/`)).toBeInTheDocument();
  });

  it('renders confidential client with client secret section', async () => {
    MockApiClient.addMockResponse({
      url: '/api-applications/conf-app/',
      body: {
        allowedOrigins: ['http://example.com'],
        clientID: 'conf-app',
        clientSecret: 'secret123',
        homepageUrl: 'http://example.com/homepage',
        id: 'conf-app',
        isPublic: false,
        name: 'Confidential App',
        privacyUrl: 'http://example.com/privacy',
        redirectUris: ['http://example.com/redirect'],
        termsUrl: ['http://example.com/terms'],
      },
    });

    render(<ApiApplicationDetails />, {
      initialRouterConfig: {
        route: '/settings/account/api-applications/:appId/',
        location: {
          pathname: '/settings/account/api-applications/conf-app/',
        },
      },
    });

    // Should show confidential client tag
    expect(await screen.findByText('Confidential Client')).toBeInTheDocument();

    // Should show client secret field
    expect(screen.getByLabelText('Client Secret')).toBeInTheDocument();

    // Should NOT show info alert about public clients
    expect(
      screen.queryByText(/This is a public client, designed for CLIs/)
    ).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Device Authorization URL')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Device Verification URL')).not.toBeInTheDocument();
  });
});
