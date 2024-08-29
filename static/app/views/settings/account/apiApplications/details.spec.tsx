import {
  render,
  renderGlobalModal,
  screen,
  userEvent,
} from 'sentry-test/reactTestingLibrary';

import ApiApplicationDetails from 'sentry/views/settings/account/apiApplications/details';

describe('ApiApplications', function () {
  it('renders basic details for newly created App', async function () {
    MockApiClient.addMockResponse({
      url: '/api-applications/abcd/',
      body: {
        allowedOrigins: ['http://example.com'],
        clientID: 'abcd',
        clientSecret: '1234',
        homepageUrl: 'http://example.com/homepage',
        id: 'abcd',
        name: 'Example App Name',
        privacyUrl: 'http://example.com/privacy',
        redirectUris: ['http://example.com/redirect'],
        termsUrl: ['http://example.com/terms'],
      },
    });

    render(<ApiApplicationDetails />, {
      router: {
        params: {
          appId: 'abcd',
        },
      },
    });

    expect(
      await screen.findByRole('heading', {name: 'Application Details'})
    ).toBeInTheDocument();
    expect(screen.getByDisplayValue('http://example.com')).toBeInTheDocument();
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
  });

  it('handles client secret rotation', async function () {
    MockApiClient.addMockResponse({
      url: '/api-applications/abcd/',
      body: {
        allowedOrigins: ['http://example.com'],
        clientID: 'abcd',
        clientSecret: null,
        homepageUrl: 'http://example.com/homepage',
        id: 'abcd',
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
      router: {
        params: {
          appId: 'abcd',
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
});
