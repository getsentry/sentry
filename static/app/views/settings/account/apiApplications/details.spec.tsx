import {initializeOrg} from 'sentry-test/initializeOrg';
import {
  render,
  renderGlobalModal,
  screen,
  userEvent,
} from 'sentry-test/reactTestingLibrary';

import ApiApplicationDetails from 'sentry/views/settings/account/apiApplications/details';

describe('ApiApplications', function () {
  it('renders basic details for newly created App', function () {
    const {router} = initializeOrg();

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

    render(
      <ApiApplicationDetails
        router={router}
        location={router.location}
        routes={router.routes}
        route={{}}
        routeParams={{}}
        params={{
          appId: 'abcd',
        }}
      />
    );
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
    const {router} = initializeOrg();

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

    render(
      <ApiApplicationDetails
        router={router}
        location={router.location}
        routes={router.routes}
        route={{}}
        routeParams={{}}
        params={{
          appId: 'abcd',
        }}
      />
    );
    renderGlobalModal();

    expect(screen.getByText('hidden')).toBeInTheDocument();
    expect(
      screen.getByRole('button', {name: 'Rotate client secret'})
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', {name: 'Rotate client secret'}));

    expect(
      screen.getByText('This will be the only time your client secret is visible!')
    ).toBeInTheDocument();
    expect(screen.getByText('Rotated Client Secret')).toBeInTheDocument();
    expect(screen.getByText('Your client secret is:')).toBeInTheDocument();
    expect(screen.getByText('newSecret!')).toBeInTheDocument();

    expect(rotateSecretApiCall).toHaveBeenCalledTimes(1);
  });
});
